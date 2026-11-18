import { BadRequestException } from '@nestjs/common';

/**
 * As opções do cron job "Aviso de disco quase cheio", todas escolhidas pelo utilizador
 * (nenhum valor imposto): o limite, que CTs e VMs, se avisa nas Notificações e se o agente
 * pega no caso — e, com o agente, os travões do que pode fazer sem perguntar.
 */
export interface DiskAlertOptions {
  thresholdPercent: number;
  /** "all" ou os vmid escolhidos. */
  guests: 'all' | number[];
  notify: boolean;
  agent: boolean;
  /** O agente que recebe os casos (vazio = o primeiro com as ferramentas disk_alert_*). */
  agentKey: string | null;
  /** Até quantos GB pode ficar um disco sem perguntar. */
  maxDiskGb: number | null;
  /** Quantos GB acrescenta de cada vez sem perguntar. */
  stepGb: number | null;
  /** O storage do Proxmox nunca fica com menos do que isto livre. */
  minStorageFreeGb: number | null;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const positive = (value: unknown, field: string, required: boolean) => {
  if (value === undefined || value === null || value === '') {
    if (required) throw new BadRequestException(`Escolhe ${field}.`);
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 100_000) {
    throw new BadRequestException(`${field} tem de ser um número positivo.`);
  }
  return number;
};

/** Valida as opções; ao ligar (intervalo > 0) o limite é obrigatório, e com agente os travões também. */
export function diskAlertOptions(
  raw: unknown,
  enabling: boolean,
): DiskAlertOptions {
  const input = isObject(raw) ? raw : {};
  const threshold = positive(input.thresholdPercent, 'o limite (%)', enabling);
  if (threshold !== null && (threshold < 10 || threshold > 99)) {
    throw new BadRequestException('O limite tem de estar entre 10% e 99%.');
  }
  const guests = Array.isArray(input.guests)
    ? [...new Set(input.guests.map(Number).filter(Number.isInteger))]
    : 'all';
  if (Array.isArray(guests) && !guests.length && enabling) {
    throw new BadRequestException('Escolhe pelo menos um CT ou VM.');
  }
  const agent = input.agent === true;
  return {
    thresholdPercent: threshold ?? 0,
    guests,
    notify: input.notify === true,
    agent,
    agentKey:
      typeof input.agentKey === 'string' && input.agentKey.trim()
        ? input.agentKey.trim().slice(0, 60)
        : null,
    maxDiskGb: positive(
      input.maxDiskGb,
      'o máximo do disco (GB)',
      agent && enabling,
    ),
    stepGb: positive(
      input.stepGb,
      'quanto aumentar de cada vez (GB)',
      agent && enabling,
    ),
    minStorageFreeGb: positive(
      input.minStorageFreeGb,
      'o espaço livre mínimo no storage (GB)',
      agent && enabling,
    ),
  };
}
