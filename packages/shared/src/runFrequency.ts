/**
 * Frequências de execução das regras de email, da sincronização de tarefas e da
 * análise que propõe regras novas.
 *
 * Os valores têm de bater com o enum RunFrequency do schema Prisma — é ele que manda
 * na base de dados; isto é a cópia que o frontend consegue importar.
 */
export const RUN_FREQUENCIES = [
  'EVERY_15_MINUTES',
  'EVERY_30_MINUTES',
  'HOURLY',
  'EVERY_2_HOURS',
  'EVERY_4_HOURS',
  'EVERY_6_HOURS',
  'EVERY_8_HOURS',
  'DAILY',
  'WEEKLY',
] as const;

export type RunFrequency = (typeof RUN_FREQUENCIES)[number];

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Intervalo de cada frequência, usado pelos schedulers para saber se uma conta venceu. */
export const RUN_FREQUENCY_INTERVAL_MS: Record<RunFrequency, number> = {
  EVERY_15_MINUTES: 15 * MINUTE,
  EVERY_30_MINUTES: 30 * MINUTE,
  HOURLY: HOUR,
  EVERY_2_HOURS: 2 * HOUR,
  EVERY_4_HOURS: 4 * HOUR,
  EVERY_6_HOURS: 6 * HOUR,
  EVERY_8_HOURS: 8 * HOUR,
  DAILY: 24 * HOUR,
  WEEKLY: 7 * 24 * HOUR,
};

// Os textos de cada frequência são da interface e vivem nas traduções do frontend
// (namespace "frequency"), não aqui.
