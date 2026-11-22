import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AppUpdateStatus,
  ConnectedAccount,
  Prisma,
  UpdateCheckPhase,
} from 'src/generated/prisma/client/client';
import { DocsService } from 'src/docs/docs.service';
import { normalizeText } from 'src/docs/helpers/docText';
import { cleanVersion, compareVersions } from 'src/integrations/releases';
import { HaUpdateItem, haUpdates } from 'src/home-assistant/helpers/haUpdates';
import { createHomeAssistantClient } from 'src/home-assistant/home-assistant.client';
import { decryptAccount } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { UpdateAttemptService } from './update-attempt.service';
import { UpdateRecordService } from './update-record.service';
import {
  ATTEMPT_LEGEND,
  COMPONENT_LABELS,
  HA_CORE_UPDATE,
} from './app-update.constants';
import { PrepareInput, UpdateWithAccount } from './app-update.types';
import { addonSource, repositoryFromUrl } from './helpers/releaseSources';
import { afterPoints, beforePoints } from './helpers/updateChecks';
import { agentChecks, checklistGaps, specDocsOf } from './helpers/checklist';
import { attemptChecks } from './helpers/attemptChecks';
import { commonChecks } from './helpers/measuredChecks';
import { specText } from './helpers/specText';
import { updateDocs } from './helpers/updateDocs';
import { isAvailable, updateLabel } from './helpers/updateFields';
import { newerVersion } from './helpers/newerVersion';
import { now } from './helpers/updateDates';

/**
 * As peças dentro do Home Assistant (add-ons, repositórios do HACS, firmware…):
 * cada versão nova vira uma atualização própria, que se prepara e instala pelo
 * próprio Home Assistant.
 */
@Injectable()
export class HaComponentsService {
  private readonly logger = new Logger('AppUpdateService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly docs: DocsService,
    private readonly attempts: UpdateAttemptService,
    private readonly record: UpdateRecordService,
  ) {}

  /**
   * Preparar uma peça dentro do Home Assistant (add-on, repositório do HACS,
   * firmware…). Instala-se pelo próprio Home Assistant, com backup; não há
   * comandos no servidor nem snapshot. O resto é igual: checklist com prova,
   * especificação para aprovar e, depois, o "feito quando".
   */
  async prepareComponent(
    update: UpdateWithAccount,
    input: PrepareInput,
  ): Promise<string> {
    const docs = await updateDocs(this.docs, update, null, null);
    const points = beforePoints(docs);
    const donePoints = afterPoints(docs);
    const steps = await this.record.stepStates(update);
    // O backup só vai onde a entidade o suporta (os add-ons); nas outras o HA recusa-o (500).
    const install = `ha_update_install {"action": "install", "entity_id": "${update.component}"} (+ "backup": true só se o supported_features da entidade tiver o bit 8, como nos add-ons)`;
    const measured = await commonChecks(this.prisma, update);
    const attempt = await this.attempts.open(update, {
      title: `${updateLabel(update)} ${update.fromVersion} → ${update.toVersion}`,
      before: points,
      after: donePoints,
      measured,
      docs: specDocsOf(docs),
      fresh: !input.checklist,
    });
    if (!input.checklist) {
      return (
        `Preparar ${updateLabel(update)} ${update.fromVersion} → ${update.toVersion} (dentro do Home Assistant).\n\n` +
        `COMO SE INSTALA: pelo próprio Home Assistant — ${install}. Não há comandos no servidor.\n\n` +
        `${ATTEMPT_LEGEND}\n${this.attempts.describe(attempt)}\n\n` +
        (steps.length
          ? `PASSOS À MÃO:\n${steps.map((step) => `- ${step.done ? '✅ feito' : '⏳ por fazer'}: ${step.step}`).join('\n')}\n\n`
          : '') +
        `DOCUMENTOS:\n${docs.map((doc) => `── ${doc.title} (${doc.id}) ──\n${doc.content.trim()}`).join('\n\n')}\n\n` +
        (docs.some((doc) =>
          doc.tags.some((tag) => normalizeText(tag) === 'pecas'),
        )
          ? ''
          : '⚠ Não há nenhum documento obrigatório da app marcado com a etiqueta "peças": as regras para estas atualizações ainda não estão escritas. Propõe-nas com docs_propose e pergunta ao utilizador antes de avançar.\n\n') +
        'Valida cada ponto (com as tuas ferramentas; o backup é o do próprio Home Assistant, com backup: true no update.install) e marca-o logo com update_check. Quando tiveres tudo, chama update_prepare outra vez com checklist: [] para escrever a especificação.'
      );
    }
    await this.attempts.markMany(
      update.id,
      UpdateCheckPhase.BEFORE,
      input.checklist,
      'agent',
    );
    const checks = await attemptChecks(
      this.attempts,
      update.id,
      UpdateCheckPhase.BEFORE,
      [...measured, ...agentChecks(input.checklist)],
    );
    const specDocs = specDocsOf(docs);
    const spec = specText(update, {
      target: `Home Assistant (${update.component})`,
      commands: [install],
      donePoints,
      checks,
      steps,
      specDocs,
      rollback:
        'o backup do próprio Home Assistant (o backup: true do update.install); se ficar mal, restaura-se esse backup ou volta-se à versão anterior pelo próprio Home Assistant. Passa a Waiting for reply com o problema, e eu digo o que fazer.',
    });
    await this.record.save(
      update,
      {
        checks: checks as unknown as Prisma.InputJsonValue,
        spec,
        specDocs: specDocs,
        afterChecks: Prisma.DbNull,
        verifyStartedAt: null,
      },
      `📜 Especificação escrita.\n\n${spec}`,
    );
    return (
      `A especificação ficou no registo.${checklistGaps(checks)}\n` +
      'Segue as regras: se pedirem a aprovação dele, mostra-lhe a especificação (o que é, de → para, como se instala, feito quando, riscos) e espera pelo sim numa mensagem dele. ' +
      `Depois instala com ha_update_install (action install, entity_id ${update.component}; backup true só se a entidade o aceitar). ` +
      'O MyHomeLab vê a versão nova em até 10 minutos e passa a atualização a Verifying; depois verificas o "feito quando" com update_verify.'
    );
  }

  /**
   * As peças do Home Assistant (add-ons, repositórios do HACS, firmware…): cada
   * versão nova vira uma atualização própria (tarefa, registo, estudo); quando a
   * peça fica instalada (por nós ou à mão), a atualização passa a Verifying.
   */
  async checkHomeAssistantComponents(
    account: ConnectedAccount,
    items?: HaUpdateItem[],
  ): Promise<void> {
    if (
      account.provider !== 'HOME_ASSISTANT' ||
      !account.isActive ||
      !account.baseUrl ||
      !account.accessToken
    ) {
      return;
    }
    let list = items;
    if (!list) {
      const client = createHomeAssistantClient(
        account.baseUrl,
        account.accessToken,
      );
      const [states, registries] = await Promise.all([
        client.states(),
        client.registries(),
      ]);
      list = haUpdates(states, registries.entities);
    }
    const existing = await this.prisma.appUpdate.findMany({
      where: { accountId: account.id, component: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    const client = createHomeAssistantClient(
      account.baseUrl,
      account.accessToken,
    );
    const sourceOf = async (item: HaUpdateItem) =>
      item.addonSlug
        ? addonSource(
            (await client.addonInfo(item.addonSlug).catch(() => null))?.url,
          )
        : null;
    for (const item of list) {
      if (item.entityId === HA_CORE_UPDATE) continue;
      const mine = existing.filter(
        (update) => update.component === item.entityId,
      );
      const open = mine.find((update) =>
        (
          [
            AppUpdateStatus.NEW,
            AppUpdateStatus.STUDY,
            AppUpdateStatus.STUDYING,
            AppUpdateStatus.READY,
            AppUpdateStatus.WAITING,
            AppUpdateStatus.LATER,
          ] as AppUpdateStatus[]
        ).includes(update.status),
      );
      const latest = item.latest ? cleanVersion(item.latest) : null;
      const installed = item.installed ? cleanVersion(item.installed) : null;

      if (open && !open.repository && item.addonSlug) {
        const source = await sourceOf(item);
        if (source) {
          await this.prisma.appUpdate.update({
            where: { id: open.id },
            data: {
              repository: source.repository,
              releaseUrl: open.releaseUrl ?? source.releaseUrl,
            },
          });
        }
      }

      // Uma em Recheck later fica parada até ao dia combinado: o HA pode dar a versão nova
      // por instalada antes de ela estar ativa (o HAOS grava-a no outro slot e só entra ao reiniciar).
      if (
        open &&
        open.status !== AppUpdateStatus.LATER &&
        installed &&
        compareVersions(installed, open.toVersion) >= 0
      ) {
        // Esta verificação corre em vários sítios ao mesmo tempo: só avança quem a vê
        // ainda no mesmo estado (senão a verificação era pedida duas vezes).
        const fresh = await this.prisma.appUpdate.findUnique({
          where: { id: open.id },
        });
        if (fresh?.status !== open.status) continue;
        // Só disponível (ninguém a abriu): foi instalada fora do MyHomeLab, fica feita.
        await this.record.save(
          open,
          isAvailable(open)
            ? { status: AppUpdateStatus.DONE, finishedAt: now() }
            : { status: AppUpdateStatus.VERIFYING, verifyStartedAt: null },
          isAvailable(open)
            ? `Já está instalada no Home Assistant (na ${installed}), fora do MyHomeLab.`
            : `✅ Instalada no Home Assistant (está na ${installed}). Falta confirmar o "feito quando".`,
        );
        continue;
      }
      if (!item.pending || !latest) continue;
      if (open) {
        if (cleanVersion(open.toVersion) === latest) continue;
        const newer = newerVersion(open, latest);
        await this.record.save(
          open,
          { toVersion: latest, releaseUrl: item.releaseUrl, ...newer.data },
          newer.text,
        );
        continue;
      }
      if (mine.some((update) => cleanVersion(update.toVersion) === latest)) {
        continue;
      }
      const source = item.releaseUrl ? null : await sourceOf(item);
      const created = await this.prisma.appUpdate.create({
        data: {
          userId: account.userId,
          accountId: account.id,
          component: item.entityId,
          componentTitle: item.title,
          componentGroup: item.group,
          repository: repositoryFromUrl(item.releaseUrl) ?? source?.repository,
          fromVersion: installed ?? '?',
          toVersion: latest,
          releaseUrl: item.releaseUrl ?? source?.releaseUrl,
        },
      });
      await this.record.save(
        created,
        {},
        `Saiu a versão ${latest} de ${item.title} (${COMPONENT_LABELS[item.group]}; está instalada a ${installed ?? '?'}). Fica disponível (um agente abre-a quando a tratar).`,
      );
    }
  }

  /** As contas com peças preparadas ou à espera: vê-se mais vezes se já foram instaladas. */
  async checkPreparedComponents(): Promise<void> {
    const prepared = await this.prisma.appUpdate.findMany({
      where: {
        component: { not: null },
        spec: { not: null },
        status: { in: [AppUpdateStatus.READY, AppUpdateStatus.WAITING] },
      },
      select: { accountId: true },
      distinct: ['accountId'],
    });
    for (const { accountId } of prepared) {
      if (!accountId) continue;
      const account = await this.prisma.connectedAccount.findUnique({
        where: { id: accountId },
      });
      if (!account) continue;
      await this.checkHomeAssistantComponents(decryptAccount(account)).catch(
        (error: unknown) =>
          this.logger.warn(
            `Peças do Home Assistant: ${error instanceof Error ? error.message : String(error)}`,
          ),
      );
    }
  }
}
