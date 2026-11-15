import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { updateConnectedAccount } from 'src/connected-account/helpers/updateConnectedAccount';
import { UpdateConnectedAccountDto } from 'src/connected-account/dto/update-connected-account.dto';
import { EmailRuleProposalService } from 'src/email-rule-proposal/email-rule-proposal.service';
import { RunFrequency } from 'src/generated/prisma/client/client';
import { resolveAccount, describeRule } from './manageEmailRules';

/** Os nomes que o utilizador vê no cartão "Regras propostas". */
const FREQUENCY_NAMES: Record<RunFrequency, string> = {
  EVERY_15_MINUTES: 'a cada 15 minutos',
  EVERY_30_MINUTES: 'a cada 30 minutos',
  HOURLY: 'de hora a hora',
  EVERY_2_HOURS: 'a cada 2 horas',
  EVERY_4_HOURS: 'a cada 4 horas',
  EVERY_6_HOURS: 'a cada 6 horas',
  EVERY_8_HOURS: 'a cada 8 horas',
  DAILY: 'uma vez por dia',
  WEEKLY: 'uma vez por semana',
};

/** Ligar sem dizer a frequência fica uma vez por dia — o mais comum no cartão. */
const DEFAULT_FREQUENCY: RunFrequency = 'DAILY';

interface ProposalSettings {
  emailAddress: string | null;
  proposalFrequency: RunFrequency | null;
  autoImplementProposalsAfterDays: number | null;
  lastProposalRunAt: Date | null;
}

const describeSettings = (account: ProposalSettings) =>
  `Regras propostas de ${account.emailAddress}: ` +
  (account.proposalFrequency
    ? `ligadas, análise ${FREQUENCY_NAMES[account.proposalFrequency]}`
    : 'desligadas (só se analisa quando se pede)') +
  '; implementar sozinhas: ' +
  (account.autoImplementProposalsAfterDays != null
    ? `ao fim de ${account.autoImplementProposalsAfterDays} dias sem mexer`
    : 'nunca') +
  '; última análise: ' +
  (account.lastProposalRunAt
    ? account.lastProposalRunAt.toLocaleString('pt-PT', {
        timeZone: 'Europe/Lisbon',
      })
    : 'nunca') +
  '.';

export async function getProposalSettingsTool(
  accountEmail: string | undefined,
  repository: PrismaConnectedAccountRepository,
  userId: string,
): Promise<string> {
  const account = await resolveAccount(accountEmail, repository, userId);
  return describeSettings(account);
}

/**
 * O mesmo que o cartão do site: passa pelo UpdateConnectedAccountDto, por isso os
 * limites (1 a 60 dias, frequências válidas) são exatamente os mesmos.
 */
export async function setProposalSettingsTool(
  input: {
    accountEmail?: string;
    enabled?: boolean;
    frequency?: RunFrequency;
    autoImplementAfterDays?: number | null;
  },
  repository: PrismaConnectedAccountRepository,
  userId: string,
): Promise<string> {
  const account = await resolveAccount(input.accountEmail, repository, userId);

  const changes: UpdateConnectedAccountDto = {};
  if (input.enabled === false) changes.proposalFrequency = null;
  else if (input.frequency) changes.proposalFrequency = input.frequency;
  else if (input.enabled === true && !account.proposalFrequency)
    changes.proposalFrequency = DEFAULT_FREQUENCY;
  if (input.autoImplementAfterDays !== undefined)
    changes.autoImplementProposalsAfterDays = input.autoImplementAfterDays;

  if (!Object.keys(changes).length) return describeSettings(account);

  const errors = await validate(
    plainToInstance(UpdateConnectedAccountDto, changes),
  );
  if (errors.length) {
    throw new Error(
      `Valores inválidos: ${errors
        .flatMap((error) => Object.values(error.constraints ?? {}))
        .join('; ')}. Os dias vão de 1 a 60 (ou null = nunca).`,
    );
  }

  const updated = await updateConnectedAccount(
    account.id,
    userId,
    changes,
    repository,
  );
  return `Feito. ${describeSettings(updated)}`;
}

/** A regra de uma proposta vem em JSON, sem os campos que ficaram por omissão. */
const describeProposedRule = (rule: Record<string, unknown>) =>
  describeRule({
    name: typeof rule.name === 'string' ? rule.name : 'sem nome',
    isActive: rule.isActive !== false,
    fromContains: (rule.fromContains as string[] | undefined) ?? [],
    subjectContains: (rule.subjectContains as string[] | undefined) ?? [],
    keywords: (rule.keywords as string[] | undefined) ?? [],
    mailKind: typeof rule.mailKind === 'string' ? rule.mailKind : 'ANY',
    markAsRead: rule.markAsRead === true,
    markAsImportant: rule.markAsImportant === true,
    markAsStarred: rule.markAsStarred === true,
    removeFromInbox: rule.removeFromInbox === true,
    labelPaths:
      (
        rule.labelPaths as { path: string; labelMode?: string }[] | undefined
      )?.map((entry) => ({
        path: entry.path,
        labelMode: entry.labelMode ?? 'ALL_LEVELS',
      })) ?? [],
  });

export async function listEmailProposalsTool(
  accountEmail: string | undefined,
  repository: PrismaConnectedAccountRepository,
  proposals: EmailRuleProposalService,
  userId: string,
): Promise<string> {
  const account = await resolveAccount(accountEmail, repository, userId);
  const { pending } = await proposals.list(userId, account.id);
  if (!pending.length)
    return `Não há propostas pendentes em ${account.emailAddress}. ${describeSettings(account)}`;

  return (
    `Propostas pendentes de ${account.emailAddress}:\n` +
    pending
      .map(
        (proposal, index) =>
          `${index + 1}. id ${proposal.id} — ${describeProposedRule(
            proposal.rule as Record<string, unknown>,
          )} — motivo: ${proposal.reason}` +
          (proposal.autoImplementAt
            ? ` — passa a regra sozinha a ${proposal.autoImplementAt.toLocaleDateString('pt-PT')}`
            : ''),
      )
      .join('\n')
  );
}

export async function analyzeEmailProposalsTool(
  accountEmail: string | undefined,
  repository: PrismaConnectedAccountRepository,
  proposals: EmailRuleProposalService,
  userId: string,
): Promise<string> {
  const account = await resolveAccount(accountEmail, repository, userId);
  const result = await proposals.analyzeNow(userId, account.id);
  return (
    `Análise feita em ${account.emailAddress}: ${result.created} propostas novas, ` +
    `${result.updated} atualizadas, ${result.deleted} retiradas, ${result.rejected} rejeitadas por não serem válidas; ` +
    `${result.unlabeled} emails sem marcador analisados.` +
    (result.comment ? ` Comentário: ${result.comment}` : '') +
    ' Usa list_email_proposals para as ver.'
  );
}

export async function implementEmailProposalTool(
  input: { accountEmail?: string; proposalId?: string; all?: boolean },
  repository: PrismaConnectedAccountRepository,
  proposals: EmailRuleProposalService,
  userId: string,
): Promise<string> {
  const account = await resolveAccount(input.accountEmail, repository, userId);
  if (input.all) {
    const { implemented } = await proposals.implementAll(userId, account.id);
    return `Implementei ${implemented} propostas como regras em ${account.emailAddress}.`;
  }
  if (!input.proposalId)
    throw new Error('Diz qual proposta (o id) ou all = true para todas.');
  await proposals.implement(userId, account.id, input.proposalId);
  return `A proposta ${input.proposalId} passou a regra em ${account.emailAddress}.`;
}

export async function dismissEmailProposalTool(
  input: { accountEmail?: string; proposalId: string },
  repository: PrismaConnectedAccountRepository,
  proposals: EmailRuleProposalService,
  userId: string,
): Promise<string> {
  const account = await resolveAccount(input.accountEmail, repository, userId);
  await proposals.dismiss(userId, account.id, input.proposalId);
  return `Recusei a proposta ${input.proposalId} em ${account.emailAddress}.`;
}
