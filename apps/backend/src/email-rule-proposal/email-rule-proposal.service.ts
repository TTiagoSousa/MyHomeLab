import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RUN_FREQUENCY_INTERVAL_MS } from '@myhomelab/shared';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ConnectedAccount,
  ConnectionProvider,
  EmailRuleProposal,
  Prisma,
  ProposalStatus,
} from 'src/generated/prisma/client/client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { findConnectedAccount } from 'src/connected-account/helpers/findConnectedAccount';
import { ensureFreshAccessToken } from 'src/connected-account/helpers/ensureFreshAccessToken';
import { PrismaEmailRuleRepository } from 'src/email-rule/repositories/prisma/prisma-email-rule-repository';
import { EmailRuleWithLabelPaths } from 'src/email-rule/repositories/email-rule-repository';
import { findAllEmailRules } from 'src/email-rule/helpers/findAllEmailRules';
import { createEmailRule } from 'src/email-rule/helpers/createEmailRule';
import { CreateEmailRuleDto } from 'src/email-rule/dto/create-email-rule.dto';
import { UpdateEmailRuleDto } from 'src/email-rule/dto/update-email-rule.dto';
import { AiCredentialService } from 'src/ai-credential/ai-credential.service';
import { AI_ERRORS, aiFailure } from 'src/ai-credential/ai-providers';
import type { AiClient } from 'src/ai-credential/ai-client';
import { AgentActivityService } from 'src/agent-activity/agent-activity.service';
import { collectUnlabeledSenders } from './helpers/collectUnlabeledSenders';
import {
  ProposalChange,
  ProposalEvidence,
  requestRuleProposals,
} from './helpers/requestRuleProposals';

/** Nunca mais que isto pendentes por conta — uma página de propostas sem fim não ajuda ninguém. */
const MAX_PENDING = 8;
const RECENT_DECIDED = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AnalysisResult {
  created: number;
  updated: number;
  deleted: number;
  /** Propostas do Claude que não passaram a validação (e porquê, nos logs). */
  rejected: number;
  unlabeled: number;
  /** O resumo do Claude sobre o que decidiu — aparece no aviso de "Analisar agora". */
  comment: string | null;
}

/**
 * As regras propostas: de X em X tempo (ou a pedido) o Jarvis olha para os
 * emails sem marcadores e cria, revê ou apaga propostas. O utilizador
 * implementa, edita ou rejeita; as editadas e rejeitadas a análise já não
 * toca. Opcionalmente, uma proposta em que ninguém mexeu passa a regra
 * sozinha ao fim de N dias.
 */
@Injectable()
export class EmailRuleProposalService {
  private readonly logger = new Logger(EmailRuleProposalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectedAccounts: PrismaConnectedAccountRepository,
    private readonly emailRules: PrismaEmailRuleRepository,
    private readonly aiCredentials: AiCredentialService,
    private readonly activity: AgentActivityService,
  ) {}

  async list(userId: string, accountId: string) {
    const account = await findConnectedAccount(
      accountId,
      userId,
      this.connectedAccounts,
    );
    const [pending, recent] = await Promise.all([
      this.prisma.emailRuleProposal.findMany({
        where: { accountId, status: ProposalStatus.PENDING },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.emailRuleProposal.findMany({
        where: { accountId, status: { not: ProposalStatus.PENDING } },
        orderBy: { decidedAt: 'desc' },
        take: RECENT_DECIDED,
      }),
    ]);
    return {
      lastAnalysisAt: account.lastProposalRunAt,
      pending: pending.map((proposal) => this.toView(proposal, account)),
      recent: recent.map((proposal) => this.toView(proposal, account)),
    };
  }

  /** "Analisar agora". */
  async analyzeNow(userId: string, accountId: string): Promise<AnalysisResult> {
    const account = await findConnectedAccount(
      accountId,
      userId,
      this.connectedAccounts,
    );
    if (account.provider !== ConnectionProvider.GMAIL) {
      throw new BadRequestException(
        'As regras propostas só existem para contas Gmail.',
      );
    }
    const ai = await this.aiCredentials.getClient(userId);
    if (!ai) {
      throw new PreconditionFailedException({
        code: AI_ERRORS.KEY_MISSING,
        message:
          'Para propor regras, o Jarvis precisa da tua chave de IA (Assistente → Definições → IA).',
      });
    }
    try {
      return await this.analyze(account, ai);
    } catch (error) {
      throw aiFailure(error) ?? error;
    }
  }

  async update(
    userId: string,
    accountId: string,
    id: string,
    dto: UpdateEmailRuleDto,
  ) {
    const account = await findConnectedAccount(
      accountId,
      userId,
      this.connectedAccounts,
    );
    const proposal = await this.findPending(accountId, id);
    const rule = await validateRule({ ...(proposal.rule as object), ...dto });
    if (!rule) throw new BadRequestException('A regra não é válida.');
    const updated = await this.prisma.emailRuleProposal.update({
      where: { id },
      data: { rule: rule as Prisma.InputJsonValue, userEdited: true },
    });
    return this.toView(updated, account);
  }

  async dismiss(userId: string, accountId: string, id: string): Promise<void> {
    await findConnectedAccount(accountId, userId, this.connectedAccounts);
    await this.findPending(accountId, id);
    await this.prisma.emailRuleProposal.update({
      where: { id },
      data: { status: ProposalStatus.DISMISSED, decidedAt: new Date() },
    });
  }

  /**
   * Uma proposta recusada volta a estar pendente. Fica como escolhida pelo
   * utilizador (userEdited), para a análise seguinte não a voltar a apagar.
   */
  async restore(userId: string, accountId: string, id: string) {
    const account = await findConnectedAccount(
      accountId,
      userId,
      this.connectedAccounts,
    );
    const proposal = await this.prisma.emailRuleProposal.findFirst({
      where: { id, accountId, status: ProposalStatus.DISMISSED },
    });
    if (!proposal) throw new NotFoundException('Proposta não encontrada');
    const restored = await this.prisma.emailRuleProposal.update({
      where: { id },
      data: {
        status: ProposalStatus.PENDING,
        decidedAt: null,
        userEdited: true,
      },
    });
    return this.toView(restored, account);
  }

  async implement(userId: string, accountId: string, id: string) {
    await findConnectedAccount(accountId, userId, this.connectedAccounts);
    return this.implementProposal(await this.findPending(accountId, id));
  }

  async implementAll(userId: string, accountId: string) {
    await findConnectedAccount(accountId, userId, this.connectedAccounts);
    const pending = await this.prisma.emailRuleProposal.findMany({
      where: { accountId, status: ProposalStatus.PENDING },
      orderBy: { createdAt: 'asc' },
    });
    let implemented = 0;
    for (const proposal of pending) {
      if (await this.implementProposal(proposal).catch(() => null))
        implemented++;
    }
    return { implemented };
  }

  /** Para o agendador: analisa as contas cuja frequência de propostas venceu. */
  async runDueAnalyses(): Promise<void> {
    const accounts = (
      await this.connectedAccounts.findAllActiveAcrossUsers()
    ).filter(
      (account) =>
        account.provider === ConnectionProvider.GMAIL &&
        account.proposalFrequency,
    );
    for (const account of accounts) {
      const interval = RUN_FREQUENCY_INTERVAL_MS[account.proposalFrequency!];
      const due =
        !account.lastProposalRunAt ||
        Date.now() - account.lastProposalRunAt.getTime() >= interval;
      if (!due) continue;

      const ai = await this.aiCredentials.getClient(account.userId);
      if (!ai) continue;
      try {
        await this.analyze(account, ai);
      } catch (error) {
        this.logger.warn(
          `Propostas de ${account.emailAddress}: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Marca na mesma, para uma chave sem crédito não tentar de 15 em 15 minutos.
        await this.connectedAccounts.update(account.id, {
          lastProposalRunAt: new Date(),
        });
      }
    }
  }

  /** Para o agendador: implementa as propostas em que ninguém mexeu há N dias. */
  async runDueImplementations(): Promise<void> {
    const accounts = (
      await this.connectedAccounts.findAllActiveAcrossUsers()
    ).filter((account) => account.autoImplementProposalsAfterDays != null);
    for (const account of accounts) {
      const cutoff = new Date(
        Date.now() - account.autoImplementProposalsAfterDays! * DAY_MS,
      );
      const due = await this.prisma.emailRuleProposal.findMany({
        where: {
          accountId: account.id,
          status: ProposalStatus.PENDING,
          userEdited: false,
          updatedAt: { lte: cutoff },
        },
      });
      for (const proposal of due) {
        await this.implementProposal(proposal).catch((error) =>
          this.logger.warn(
            `Proposta ${proposal.id} não implementada: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      }
    }
  }

  private async analyze(
    account: ConnectedAccount,
    ai: AiClient,
  ): Promise<AnalysisResult> {
    return this.activity.trackOwner(
      account.userId,
      'analyze_email_proposals',
      'a propor regras de email',
      async () => {
        const accessToken = await ensureFreshAccessToken(
          account.id,
          this.connectedAccounts,
        );
        const [summary, rules, pending, dismissed] = await Promise.all([
          collectUnlabeledSenders(accessToken),
          findAllEmailRules(account.id, this.emailRules),
          this.prisma.emailRuleProposal.findMany({
            where: { accountId: account.id, status: ProposalStatus.PENDING },
          }),
          this.prisma.emailRuleProposal.findMany({
            where: { accountId: account.id, status: ProposalStatus.DISMISSED },
            orderBy: { decidedAt: 'desc' },
            take: 30,
          }),
        ]);

        const { changes, comment } = await requestRuleProposals(ai, {
          summary,
          rules: rules.map(ruleForPrompt),
          pending: pending.map((proposal) => ({
            id: proposal.id,
            rule: proposal.rule as Record<string, unknown>,
            reason: proposal.reason,
            userEdited: proposal.userEdited,
          })),
          dismissed: dismissed.map(
            (proposal) => proposal.rule as Record<string, unknown>,
          ),
        });

        const result = await this.applyChanges(account.id, pending, changes);
        await this.connectedAccounts.update(account.id, {
          lastProposalRunAt: new Date(),
        });
        return { ...result, unlabeled: summary.unlabeled, comment };
      },
    );
  }

  /**
   * Aplica o que o Claude devolveu, com as regras da casa: só se mexe em
   * propostas pendentes que o utilizador não editou, cada regra tem de passar a
   * validação da API, e nunca mais de MAX_PENDING pendentes.
   */
  private async applyChanges(
    accountId: string,
    pending: EmailRuleProposal[],
    changes: ProposalChange[],
  ) {
    const editable = new Map(
      pending
        .filter((proposal) => !proposal.userEdited)
        .map((proposal) => [proposal.id, proposal]),
    );
    let pendingCount = pending.length;
    const result = { created: 0, updated: 0, deleted: 0, rejected: 0 };

    for (const change of changes) {
      if (change.action === 'delete' && editable.has(change.id)) {
        await this.prisma.emailRuleProposal.delete({
          where: { id: change.id },
        });
        editable.delete(change.id);
        pendingCount--;
        result.deleted++;
      } else if (change.action === 'update' && editable.has(change.id)) {
        const rule = await this.validateProposed(change.rule);
        if (!rule) {
          result.rejected++;
          continue;
        }
        await this.prisma.emailRuleProposal.update({
          where: { id: change.id },
          data: {
            rule: rule as Prisma.InputJsonValue,
            reason: change.reason,
            evidence: evidenceValue(change.evidence),
          },
        });
        result.updated++;
      } else if (
        change.action === 'keep' &&
        editable.has(change.id) &&
        change.evidence
      ) {
        // Os números atualizam-se sem contar como alteração: o relógio do
        // "implementar ao fim de N dias" não volta ao início por causa disso.
        const proposal = editable.get(change.id)!;
        await this.prisma
          .$executeRaw`UPDATE "EmailRuleProposal" SET "evidence" = ${JSON.stringify(change.evidence)}::jsonb WHERE "id" = ${proposal.id}`;
      } else if (change.action === 'create' && pendingCount < MAX_PENDING) {
        const rule = await this.validateProposed(change.rule);
        if (!rule || !change.reason) {
          result.rejected++;
          continue;
        }
        await this.prisma.emailRuleProposal.create({
          data: {
            accountId,
            rule: rule as Prisma.InputJsonValue,
            reason: change.reason,
            evidence: evidenceValue(change.evidence),
          },
        });
        pendingCount++;
        result.created++;
      }
    }
    return result;
  }

  /**
   * Como o validateRule, mas regista porque é que uma regra do Claude foi
   * recusada — antes era descartada em silêncio e a análise dizia "0 novas" sem
   * se perceber se o Claude não propôs nada ou se as propostas caíram aqui.
   */
  private async validateProposed(raw: unknown) {
    const errors = await ruleErrors(raw);
    if (errors.length) {
      this.logger.warn(
        `Regra proposta recusada (${errors.join('; ')}): ${JSON.stringify(raw)}`,
      );
      return null;
    }
    return validateRule(raw);
  }

  private async implementProposal(proposal: EmailRuleProposal) {
    const rule = await validateRule(proposal.rule);
    if (!rule) throw new BadRequestException('A regra proposta não é válida.');
    const created = await createEmailRule(
      proposal.accountId,
      rule,
      this.emailRules,
    );
    await this.prisma.emailRuleProposal.update({
      where: { id: proposal.id },
      data: {
        status: ProposalStatus.IMPLEMENTED,
        implementedRuleId: created.id,
        decidedAt: new Date(),
      },
    });
    return created;
  }

  private async findPending(accountId: string, id: string) {
    const proposal = await this.prisma.emailRuleProposal.findFirst({
      where: { id, accountId, status: ProposalStatus.PENDING },
    });
    if (!proposal) throw new NotFoundException('Proposta não encontrada');
    return proposal;
  }

  private toView(proposal: EmailRuleProposal, account: ConnectedAccount) {
    const autoDays = account.autoImplementProposalsAfterDays;
    return {
      id: proposal.id,
      rule: proposal.rule,
      reason: proposal.reason,
      evidence: proposal.evidence,
      status: proposal.status,
      userEdited: proposal.userEdited,
      implementedRuleId: proposal.implementedRuleId,
      decidedAt: proposal.decidedAt,
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
      autoImplementAt:
        proposal.status === ProposalStatus.PENDING &&
        !proposal.userEdited &&
        autoDays != null
          ? new Date(proposal.updatedAt.getTime() + autoDays * DAY_MS)
          : null,
    };
  }
}

/** As evidências em JSON, ou o JSON null do Prisma quando não vêm. */
const evidenceValue = (evidence?: ProposalEvidence) =>
  evidence ? (evidence as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;

/**
 * Uma regra como o Claude a deve ver: as condições e todas as ações, sem ids
 * nem datas. Só com as ações completas é que se percebe o estilo dele (o que
 * marca como lido logo, o que só marca ao arquivar, quanto tempo fica na caixa).
 */
const ruleForPrompt = (rule: EmailRuleWithLabelPaths) => ({
  name: rule.name,
  isActive: rule.isActive,
  conditionLogic: rule.conditionLogic,
  fromContains: rule.fromContains,
  subjectContains: rule.subjectContains,
  keywords: rule.keywords,
  excludeKeywords: rule.excludeKeywords,
  mailKind: rule.mailKind,
  hasAttachment: rule.hasAttachment,
  markAsRead: rule.markAsRead,
  markAsImportant: rule.markAsImportant,
  markAsStarred: rule.markAsStarred,
  stopProcessing: rule.stopProcessing,
  removeFromInbox: rule.removeFromInbox,
  removeFromInboxAfterDays: rule.removeFromInboxAfterDays,
  removeOnlyIfRead: rule.removeOnlyIfRead,
  markAsReadOnRemove: rule.markAsReadOnRemove,
  starredExpiresAfterDays: rule.starredExpiresAfterDays,
  importantExpiresAfterDays: rule.importantExpiresAfterDays,
  importantExpiresOnStar: rule.importantExpiresOnStar,
  labelPaths: rule.labelPaths.map((label) => ({
    path: label.path,
    labelMode: label.labelMode,
  })),
});

/**
 * A mesma validação do POST de regras: o que o Claude devolve (ou o que se
 * edita) só fica se for uma regra que a API aceitaria. Devolve o objeto limpo.
 */
/** Os erros de validação de uma regra, por extenso ("removeFromInboxAfterDays: must not be less than 0"). */
async function ruleErrors(raw: unknown): Promise<string[]> {
  if (!raw || typeof raw !== 'object') return ['não é um objeto'];
  const dto = plainToInstance(CreateEmailRuleDto, raw);
  const errors = await validate(dto, { whitelist: true });
  const flatten = (list: typeof errors, prefix = ''): string[] =>
    list.flatMap((error) => [
      ...Object.values(error.constraints ?? {}).map(
        (message) => `${prefix}${message}`,
      ),
      ...flatten(error.children ?? [], `${prefix}${error.property}.`),
    ]);
  return flatten(errors);
}

async function validateRule(raw: unknown): Promise<CreateEmailRuleDto | null> {
  if (!raw || typeof raw !== 'object') return null;
  const dto = plainToInstance(CreateEmailRuleDto, raw);
  const errors = await validate(dto, { whitelist: true });
  if (errors.length) return null;
  return JSON.parse(JSON.stringify(dto)) as CreateEmailRuleDto;
}
