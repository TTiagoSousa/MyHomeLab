import { AppUpdateStatus } from 'src/generated/prisma/client/client';
import { BoardStatus } from './task-board/taskBoard';

/** As que ainda estão em aberto (uma versão nova mexe nestas, não cria outra). */
export const OPEN: AppUpdateStatus[] = [
  AppUpdateStatus.NEW,
  AppUpdateStatus.STUDY,
  AppUpdateStatus.STUDYING,
  AppUpdateStatus.READY,
  AppUpdateStatus.WAITING,
  AppUpdateStatus.LATER,
  AppUpdateStatus.IN_PROGRESS,
];

export const BOARD_STATUS: Record<AppUpdateStatus, BoardStatus> = {
  NEW: 'new',
  STUDY: 'study',
  STUDYING: 'studying',
  READY: 'ready',
  WAITING: 'waiting',
  LATER: 'later',
  IN_PROGRESS: 'in_progress',
  VERIFYING: 'verifying',
  DONE: 'done',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
};

/** Um estudo que falha volta a tentar sozinho esta quantidade de vezes, depois deste tempo. */
export const STUDY_RETRIES = 1;
export const STUDY_RETRY_DELAY_MS = 3 * 60 * 60_000;

/** Uma atualização em Ready to update que o agente deixou lá pede-se outra vez só passado este tempo. */
export const INSTALL_AGAIN_MS = 20 * 60 * 60_000;

/** Cada comando de uma atualização pode demorar até 20 min (pull de imagens grandes). */
export const STEP_TIMEOUT_MS = 20 * 60_000;

/** Depois dos comandos, quanto se espera que a app responda com a versão nova. */
export const VERIFY_TIMEOUT_MS = 5 * 60_000;

/** A atualização do Core do Home Assistant é a da própria app (já tem a sua). */
export const HA_CORE_UPDATE = 'update.home_assistant_core_update';

export const COMPONENT_LABELS: Record<string, string> = {
  system: 'sistema',
  addons: 'add-on',
  hacs: 'hacs',
  firmware: 'firmware',
  other: 'integração',
  apps: 'app do Nextcloud',
};

/** Em curso ou acabadas: não se preparam nem correm. */
export const FINISHED_OR_RUNNING: AppUpdateStatus[] = [
  AppUpdateStatus.IN_PROGRESS,
  AppUpdateStatus.VERIFYING,
  AppUpdateStatus.DONE,
  AppUpdateStatus.CANCELLED,
];

/** As preparadas e ainda por correr (regras novas: aviso no histórico). */
export const PREPARED: AppUpdateStatus[] = [
  AppUpdateStatus.READY,
  AppUpdateStatus.WAITING,
  AppUpdateStatus.FAILED,
];

/** O que o utilizador pode mudar no quadro e o MyHomeLab acompanha. */
export const FROM_BOARD: Partial<Record<BoardStatus, AppUpdateStatus>> = {
  new: AppUpdateStatus.NEW,
  study: AppUpdateStatus.STUDY,
  ready: AppUpdateStatus.READY,
  waiting: AppUpdateStatus.WAITING,
  later: AppUpdateStatus.LATER,
  cancelled: AppUpdateStatus.CANCELLED,
  verifying: AppUpdateStatus.VERIFYING,
  done: AppUpdateStatus.DONE,
};

/** O histórico guarda as últimas entradas (cada uma cortada), para o registo não crescer sem fim. */
export const HISTORY_MAX = 80;
export const HISTORY_TEXT_MAX = 8000;

/** "Rever mais tarde": entre 1 dia e 3 meses. */
export const RECHECK_MAX_DAYS = 90;

/** Um ponto da tentativa que ainda ninguém validou. */
export const PENDING_EVIDENCE = 'por validar';

export const ATTEMPT_LEGEND =
  'A TENTATIVA (o que ele vê em Apps ligadas e em Documentos; 🤖 validas tu, 👤 só ele confirma — pergunta-lhe, 📏 medido pelo MyHomeLab; "prova:" diz que prova serve):';

/** O que a página recebe de cada conta (nunca os segredos). */
export const ACCOUNT_VIEW = {
  select: { id: true, provider: true, displayName: true, appVersion: true },
} as const;

/** O servidor de uma atualização do host (Proxmox VE), para as listas. */
export const HOST_VIEW = { select: { id: true, name: true } } as const;

/** O alvo de uma atualização, para o fluxo: a app ligada ou o servidor (host). */
export const UPDATE_INCLUDE = { account: true, hostServer: true } as const;

/** Onde se leem as notas das versões do Proxmox VE. */
export const PVE_ROADMAP_URL = 'https://pve.proxmox.com/wiki/Roadmap';

export const RISK = { low: 'baixo', medium: 'médio', high: 'alto' } as const;

export const RISK_ICON = { low: '🟢', medium: '🟡', high: '🔴' } as const;

export const DEFAULT_MODULES = ['Servidor'];

export const HEADLINE_ICON: Record<AppUpdateStatus, string> = {
  NEW: '🆕',
  STUDY: '⏳',
  STUDYING: '🔎',
  READY: '✅',
  WAITING: '❓',
  LATER: '⏸',
  IN_PROGRESS: '⏳',
  VERIFYING: '🧪',
  DONE: '🎉',
  FAILED: '❌',
  CANCELLED: '🚫',
};

export const STATUS_NAMES: Record<AppUpdateStatus, string> = {
  NEW: 'Todo',
  STUDY: 'espera por estudo',
  STUDYING: 'a ser estudada',
  READY: 'pronta a atualizar',
  WAITING: 'à espera da tua resposta',
  LATER: 'rever mais tarde',
  IN_PROGRESS: 'a atualizar',
  VERIFYING: 'a verificar',
  DONE: 'feita',
  FAILED: 'falhou',
  CANCELLED: 'cancelada',
};

/** Onde um estudo se pode gravar: nas outras alguém já decidiu (cancelada, para mais tarde, aprovada, a instalar ou feita). */
export const STUDY_SAVE_FROM: AppUpdateStatus[] = [
  AppUpdateStatus.NEW,
  AppUpdateStatus.STUDY,
  AppUpdateStatus.STUDYING,
  AppUpdateStatus.WAITING,
  AppUpdateStatus.FAILED,
];
