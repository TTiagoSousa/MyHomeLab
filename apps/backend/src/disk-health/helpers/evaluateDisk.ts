export type DiskIssueLevel = 'problem' | 'warning';

export interface DiskIssue {
  level: DiskIssueLevel;
  text: string;
}

export interface DiskSnapshot {
  diskType: string | null;
  health: string | null;
  wearout: number | null;
  temperature: number | null;
  reallocated: number | null;
  pending: number | null;
  mediaErrors: number | null;
}

/** Abaixo disto de vida restante, um SSD/NVMe pede substituição em breve. */
export const WEAROUT_WARNING = 10;
/** NVMe aguentam mais calor que discos SATA. */
const TEMPERATURE_WARNING = { nvme: 70, other: 55 };

/** O menor valor dos dias anteriores — se o de hoje é maior, o contador subiu. */
const lowestBefore = (
  history: DiskSnapshot[],
  field: 'reallocated' | 'pending' | 'mediaErrors',
) => {
  const values = history
    .map((reading) => reading[field])
    .filter((value): value is number => value != null);
  return values.length ? Math.min(...values) : null;
};

/**
 * As regras de saúde de um disco. Vermelho ("problem"): o SMART diz que falha,
 * ou os setores realocados/pendentes ou os erros de media subiram em relação
 * aos dias anteriores. Laranja ("warning"): setores pendentes que não sobem,
 * pouca vida ou temperatura alta. `history` são as leituras dos últimos dias,
 * sem a de hoje.
 */
export function evaluateDisk(
  current: DiskSnapshot,
  history: DiskSnapshot[],
): DiskIssue[] {
  const issues: DiskIssue[] = [];

  if (current.health && /FAIL/.test(current.health)) {
    issues.push({
      level: 'problem',
      text: 'o SMART diz que o disco está a falhar',
    });
  }

  const counters = [
    { field: 'reallocated' as const, label: 'setores realocados' },
    { field: 'pending' as const, label: 'setores pendentes' },
    { field: 'mediaErrors' as const, label: 'erros de media' },
  ];
  for (const { field, label } of counters) {
    const now = current[field];
    const before = lowestBefore(history, field);
    if (now != null && before != null && now > before) {
      issues.push({
        level: 'problem',
        text: `${label} subiram de ${before} para ${now}`,
      });
    }
  }

  const pendingGrew = issues.some((issue) =>
    issue.text.startsWith('setores pendentes'),
  );
  if (!pendingGrew && current.pending != null && current.pending > 0) {
    issues.push({
      level: 'warning',
      text: `${current.pending} setores pendentes`,
    });
  }

  if (current.wearout != null && current.wearout <= WEAROUT_WARNING) {
    issues.push({
      level: 'warning',
      text: `resta ${current.wearout}% de vida`,
    });
  }

  const limit =
    current.diskType === 'nvme'
      ? TEMPERATURE_WARNING.nvme
      : TEMPERATURE_WARNING.other;
  if (current.temperature != null && current.temperature >= limit) {
    issues.push({ level: 'warning', text: `está a ${current.temperature} °C` });
  }

  return issues;
}
