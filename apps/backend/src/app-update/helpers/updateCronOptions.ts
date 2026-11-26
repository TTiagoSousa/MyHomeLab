import { BadRequestException } from '@nestjs/common';
import { AppUpdate } from 'src/generated/prisma/client/client';

/** Os cron jobs das atualizações de uma app: a própria app e, no HA e no Nextcloud, as peças. */
export const UPDATE_CRON_JOBS = {
  app: 'updates.app',
  haComponents: 'updates.ha_components',
  nextcloudApps: 'updates.nextcloud_apps',
} as const;

/** Que atualizações da app o cron job trata: a da própria app ou as das peças dela. */
export type UpdatePart = 'app' | 'components';

export const partOfJob = (key: string): UpdatePart | null =>
  key === UPDATE_CRON_JOBS.app
    ? 'app'
    : key === UPDATE_CRON_JOBS.haComponents ||
        key === UPDATE_CRON_JOBS.nextcloudApps
      ? 'components'
      : null;

export const partOfUpdate = (update: Pick<AppUpdate, 'component'>) =>
  update.component ? 'components' : 'app';

/** As colunas onde uma atualização nova pode entrar: Todo ou Espera por estudo. */
export const UPDATE_COLUMNS = ['new', 'study'] as const;
export type UpdateColumn = (typeof UPDATE_COLUMNS)[number];

/**
 * As opções escolhidas pelo utilizador: se a versão nova vai logo para o quadro, para que
 * projeto e para que coluna. Sem quadro fica só disponível, como antes.
 */
export interface UpdateCronOptions {
  board: boolean;
  projectId: string | null;
  column: UpdateColumn;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Valida as opções; ao ligar com quadro, o projeto é obrigatório. */
export function updateCronOptions(
  raw: unknown,
  enabling: boolean,
): UpdateCronOptions {
  const input = isObject(raw) ? raw : {};
  const board = input.board === true;
  const projectId =
    typeof input.projectId === 'string' && input.projectId.trim()
      ? input.projectId.trim().slice(0, 60)
      : null;
  if (board && enabling && !projectId) {
    throw new BadRequestException('Escolhe o projeto.');
  }
  const column = UPDATE_COLUMNS.includes(input.column as UpdateColumn)
    ? (input.column as UpdateColumn)
    : 'study';
  return { board, projectId, column };
}
