import {
  AppUpdate,
  AppUpdateStatus,
  ConnectedAccount,
  ConnectionProvider,
  DocLinkType,
} from 'src/generated/prisma/client/client';
import { appLabel } from 'src/docs/docs.service';
import { VERSION_SOURCES } from 'src/connected-account/helpers/checkAppVersion';
import { decryptAccount } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { BoardLink } from '../task-board/taskBoard';
import { UpdateCheck } from './updateChecks';
import { HistoryEntry, StepTask, UpdateWithAccount } from '../app-update.types';

interface UpdateTarget {
  account: { provider: ConnectionProvider; displayName: string | null } | null;
  hostServer?: { name: string } | null;
}

/** O alvo de uma atualização: a app ligada, ou o Proxmox VE do servidor (ex.: "Proxmox VE · HomeLab"). */
export const targetLabel = (update: UpdateTarget) =>
  update.account
    ? appLabel(update.account)
    : `Proxmox VE · ${update.hostServer?.name ?? 'servidor'}`;

/** O nome de uma atualização: a app, a app e a peça (ex.: "Home Assistant · Tapo Control") ou, no host, os pacotes do sistema. */
export const updateLabel = (update: AppUpdate & UpdateTarget) =>
  update.componentTitle
    ? `${targetLabel(update)} · ${update.componentTitle}`
    : update.hostPackages !== null
      ? `${targetLabel(update)} · pacotes do sistema (${update.hostPackages})`
      : targetLabel(update);

/**
 * Uma peça dentro do Home Assistant (add-on, HACS, firmware…): instala-se pelo
 * próprio Home Assistant. As apps dentro do Nextcloud também são peças, mas
 * instalam-se com comandos no CT, como a app.
 */
export const isHaComponent = (update: {
  component: string | null;
  account: { provider: ConnectionProvider } | null;
}) =>
  Boolean(update.component) &&
  update.account?.provider === ConnectionProvider.HOME_ASSISTANT;

/** É uma atualização do próprio servidor (o host Proxmox VE), e não de uma app. */
export const isHostUpdate = (
  update: Pick<AppUpdate, 'accountId' | 'hostServerId'>,
) => !update.accountId && Boolean(update.hostServerId);

/**
 * Disponível: o MyHomeLab viu a versão nova, mas ninguém a abriu ainda (sem tarefa
 * nem registo). Um agente abre-a com update_start; uma em Todo no quadro já tem tarefa.
 */
export const isAvailable = (
  update: Pick<AppUpdate, 'status' | 'boardTaskId'>,
) => update.status === AppUpdateStatus.NEW && !update.boardTaskId;

/** A ligação do alvo (nos documentos e nos agendamentos): a app ou o servidor. */
export const targetLink = (update: AppUpdate & UpdateTarget) =>
  update.accountId
    ? {
        type: DocLinkType.APP,
        targetId: update.accountId,
        label: targetLabel(update),
      }
    : {
        type: DocLinkType.SERVER,
        targetId: update.hostServerId ?? '',
        label: update.hostServer?.name ?? targetLabel(update),
      };

/** Na base de dados os segredos da conta estão cifrados; para falar com a app, em claro. */
export const plain = <T extends { account: ConnectedAccount | null }>(
  update: T,
): T => ({
  ...update,
  account: update.account ? decryptAccount(update.account) : null,
});

export const cleanList = (items: string[] | undefined) =>
  (items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 15);

export const historyOf = (update: AppUpdate): HistoryEntry[] =>
  (update.history as unknown as HistoryEntry[] | null) ?? [];

/** A secção "Como atualizar" de um documento (até ao título seguinte). */
export const howToUpdate = (content: string) => {
  const match =
    /^#{1,6}\s+como atualizar[^\n]*\n([\s\S]*?)(?=^#{1,6}\s|(?![\s\S]))/im.exec(
      content,
    );
  return match?.[1] ?? '';
};

export const stepTasksOf = (update: AppUpdate): StepTask[] =>
  (update.stepTasks as unknown as StepTask[] | null) ?? [];

export const afterChecksOf = (update: AppUpdate): UpdateCheck[] =>
  (update.afterChecks as unknown as UpdateCheck[] | null) ?? [];

export const sourcesOf = (update: AppUpdate): BoardLink[] =>
  (update.sources as unknown as BoardLink[] | null) ?? [];

/** O endereço de um documento no site (para o link na tarefa). */
export const docUrl = (docId: string) =>
  process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL.replace(/\/+$/, '')}/MyHomeLab/Docs/${docId}`
    : null;

export const appName = (update: UpdateWithAccount) =>
  update.account
    ? (VERSION_SOURCES[update.account.provider]?.appName ??
      update.account.provider)
    : 'Proxmox VE';
