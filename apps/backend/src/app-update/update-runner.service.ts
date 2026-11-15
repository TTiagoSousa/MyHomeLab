import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AppUpdateStatus,
  NotificationKind,
  ServerCommand,
} from 'src/generated/prisma/client/client';
import { ServerCommandService } from 'src/server-connection/server-command.service';
import { toProxmoxConnection } from 'src/server-connection/server-connection.service';
import { NotificationService } from 'src/notification/notification.service';
import { compareVersions } from 'src/integrations/releases';
import { createProxmoxClient } from 'src/proxmox/proxmox.client';
import { UpdateRecordService } from './update-record.service';
import {
  STEP_TIMEOUT_MS,
  UPDATE_INCLUDE,
  VERIFY_TIMEOUT_MS,
} from './app-update.constants';
import { describeChecks } from './helpers/updateChecks';
import { codeChecks, commonChecks, hostChecks } from './helpers/measuredChecks';
import { waitForVersion } from './helpers/installedVersion';
import { findGuest } from './helpers/findGuest';
import { now } from './helpers/updateDates';
import {
  INSTALL_RUNS,
  installRuns,
  watchedInstalls,
} from './helpers/installRetry';
import { isHostUpdate, plain, updateLabel } from './helpers/updateFields';

/**
 * Correr uma atualização aprovada no servidor: o snapshot, os comandos, a
 * versão nova e, se falhar, a volta ao snapshot.
 */
@Injectable()
export class UpdateRunnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serverCommands: ServerCommandService,
    private readonly notifications: NotificationService,
    private readonly record: UpdateRecordService,
  ) {}

  /** Corre uma atualização (update_run ou a aprovação na página; em segundo plano). */
  async runApproved(
    row: ServerCommand,
    options: { snapshot: boolean } = { snapshot: true },
  ): Promise<void> {
    const found = await this.prisma.appUpdate.findUnique({
      where: { id: row.updateId! },
      include: UPDATE_INCLUDE,
    });
    const update = found ? plain(found) : null;
    if (!update || update.commandId !== row.id) {
      await this.serverCommands.finishUpdate(
        row.id,
        false,
        'Este pedido já não corresponde à atualização (foi preparada outra vez).',
      );
      return;
    }
    const log: string[] = [];
    const step = (text: string) =>
      log.push(`[${new Date().toISOString().slice(11, 19)}] ${text}`);
    const finish = async (status: AppUpdateStatus, summary: string) => {
      const output = `${summary}\n\n${log.join('\n')}`;
      const installedOk = status === AppUpdateStatus.VERIFYING;
      await this.serverCommands.finishUpdate(row.id, installedOk, output);
      await this.record.save(
        update,
        {
          status,
          result: output,
          ...(installedOk ? { verifyStartedAt: null } : { finishedAt: now() }),
        },
        `${summary}\n\n\`\`\`\n${log.join('\n')}\n\`\`\``,
      );
    };

    await this.record.save(
      update,
      { status: AppUpdateStatus.IN_PROGRESS, startedAt: now() },
      `A atualizar (registo ${row.code})…`,
    );

    const server = await this.prisma.serverConnection.findUnique({
      where: { id: row.serverConnectionId },
    });
    // No host (Proxmox VE) os comandos correm no próprio servidor: não há máquina
    // nem snapshot, e por isso também não há volta atrás automática.
    const host = isHostUpdate(update);
    const machine =
      server && !host && update.guestVmid !== null
        ? await findGuest(server, String(update.guestVmid))
        : null;
    const guest = machine && typeof machine !== 'string' ? machine : null;
    if (!server || (!host && !guest)) {
      await finish(
        AppUpdateStatus.FAILED,
        `Não encontrei a máquina da atualização: ${typeof machine === 'string' ? machine : 'o servidor ou o vmid já não existem'}.`,
      );
      return;
    }

    // As medições no momento de correr ficam no registo (não decidem nada).
    step(
      `Medições ao começar:\n${describeChecks(
        guest
          ? await codeChecks(this.prisma, update, server, guest.ref)
          : [
              ...(await commonChecks(this.prisma, update)),
              ...(await hostChecks(server)),
            ],
      )}`,
    );

    const client = createProxmoxClient(toProxmoxConnection(server));
    const snapshotName =
      guest && options.snapshot
        ? `upd_${(update.account?.provider ?? 'pve').toLowerCase()}_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`.slice(
            0,
            40,
          )
        : null;
    if (!guest)
      step(
        'Sem snapshot: é o host do Proxmox (não há snapshot do host; o backup da configuração é o das regras).',
      );
    else if (!snapshotName) step('Sem snapshot (decidido pelo agente).');
    else
      try {
        const upid = await client.createSnapshot(
          guest.ref,
          snapshotName,
          `Antes de atualizar para ${update.toVersion} (MyHomeLab)`,
        );
        const status = await client.waitTask(guest.ref.node, upid, 10 * 60_000);
        if (status !== 'OK') throw new Error(`o Proxmox respondeu ${status}`);
        step(`Snapshot ${snapshotName} criado.`);
        await this.prisma.appUpdate.update({
          where: { id: update.id },
          data: { snapshotName },
        });
      } catch (error) {
        step(
          `Snapshot falhou: ${error instanceof Error ? error.message : String(error)}`,
        );
        await finish(
          AppUpdateStatus.WAITING,
          'Não atualizei: o snapshot falhou e era o caminho de volta. Corre outra vez, ou sem snapshot se as regras o permitirem.',
        );
        return;
      }

    let failure: string | null = null;
    for (const command of update.commands) {
      const result = await this.serverCommands.runUpdateStep(
        update.userId,
        server,
        {
          command,
          reason: `Atualização ${updateLabel(update)} ${update.toVersion} (registo ${row.code})`,
          requestedBy: row.requestedBy ?? undefined,
          timeoutMs: STEP_TIMEOUT_MS,
        },
      );
      step(`$ ${command}\n${(result.output ?? '').trim().slice(-1500)}`);
      if (result.status !== 'DONE') {
        failure =
          result.status === 'BLOCKED'
            ? `o comando "${command}" está na lista de proibidos`
            : `o comando "${command}" falhou (código ${result.exitCode ?? '?'})`;
        break;
      }
    }

    let installed: string | null = null;
    if (!failure) {
      installed = await waitForVersion(update);
      const what = guest ? 'a app' : 'o Proxmox';
      if (installed && compareVersions(installed, update.toVersion) >= 0) {
        step(
          `${guest ? 'A app' : 'O Proxmox'} responde na versão ${installed}.`,
        );
      } else {
        failure = installed
          ? `${what} responde mas ainda na ${installed} (esperava a ${update.toVersion})`
          : `${what} não respondeu em ${VERIFY_TIMEOUT_MS / 60_000} minutos`;
      }
    }

    if (failure && !snapshotName) {
      await finish(
        AppUpdateStatus.FAILED,
        guest
          ? `❌ A atualização falhou (${failure}). Não havia snapshot: vê a máquina.`
          : `❌ A atualização do Proxmox falhou (${failure}). No host não há volta atrás automática: vê o servidor (o backup da configuração é o que as regras mandaram fazer).`,
      );
      return;
    }
    if (failure && snapshotName && guest) {
      step(`Falhou: ${failure}. A voltar ao snapshot ${snapshotName}…`);
      try {
        const upid = await client.rollbackSnapshot(guest.ref, snapshotName);
        step(
          `Rollback: ${await client.waitTask(guest.ref.node, upid, 10 * 60_000)}.`,
        );
        const status = await client.getGuestStatus(guest.ref).catch(() => null);
        if (status && status.status !== 'running') {
          const started = await client.guestPower(guest.ref, 'start');
          step(
            `A ligar a máquina: ${await client.waitTask(guest.ref.node, started, 5 * 60_000)}.`,
          );
        }
        const back = await waitForVersion(update, 2 * 60_000, true);
        step(
          back
            ? `Depois do rollback a app responde na ${back}.`
            : 'Depois do rollback a app ainda não responde — vê já.',
        );
      } catch (error) {
        step(
          `O rollback falhou: ${error instanceof Error ? error.message : String(error)} — vê já a máquina.`,
        );
      }
      // Com o agente a acompanhar, a falha não fecha a instalação: ele vê porquê e,
      // se for simples e seguro, corrige e corre outra vez (até INSTALL_RUNS).
      const runs = await installRuns(this.prisma, update);
      if (watchedInstalls.has(update.id) && runs < INSTALL_RUNS) {
        const output = `Tentativa ${runs} de ${INSTALL_RUNS} falhou: ${failure}. Voltei ao snapshot.\n\n${log.join('\n')}`;
        await this.serverCommands.finishUpdate(row.id, false, output);
        await this.record.save(
          update,
          { status: AppUpdateStatus.IN_PROGRESS, result: output },
          [
            `↩️ Tentativa ${runs} de ${INSTALL_RUNS} falhou (${failure}) e voltei ao snapshot. O agente vê porquê e, se for simples e seguro, corrige e corre outra vez.`,
            '```',
            log.join('\n'),
            '```',
          ].join('\n'),
        );
        return;
      }
      await finish(
        AppUpdateStatus.FAILED,
        `❌ A atualização falhou (${failure}) e voltei ao snapshot${runs > 1 ? ` (${runs} tentativas)` : ''}.`,
      );
      return;
    }

    if (update.accountId) {
      await this.prisma.connectedAccount.update({
        where: { id: update.accountId },
        data: {
          appVersion: installed,
          appLatestVersion: null,
          appLatestUrl: null,
          appCheckedAt: now(),
        },
      });
    }
    await this.notifications
      .resolveUserSubject(
        update.userId,
        update.accountId
          ? `update:${update.accountId}`
          : `update:server:${update.hostServerId}`,
        NotificationKind.APP_UPDATE,
      )
      .catch(() => undefined);
    await finish(
      AppUpdateStatus.VERIFYING,
      `✅ ${updateLabel(update)} instalado na ${installed}. Falta confirmar o "feito quando" da especificação: o agente verifica cada ponto com a prova (update_verify).` +
        (snapshotName
          ? ` O snapshot ${snapshotName} fica para poderes voltar atrás.`
          : guest
            ? ''
            : ' Se o kernel mudou, o reinício é um passo à parte, com o teu sim.'),
    );
  }
}
