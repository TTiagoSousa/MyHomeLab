import { cleanVersion } from 'src/integrations/releases';

/** Um ponto verificado: pelo MyHomeLab (`code`) ou pelo agente, com a prova. */
export interface UpdateCheck {
  point: string;
  /** null = não se aplica (ex.: espaço em disco numa VM). */
  ok: boolean | null;
  evidence: string;
  source: 'code' | 'agent';
}

export const majorOf = (version: string) =>
  parseInt(cleanVersion(version).split('.')[0], 10) || 0;

/** Muda o primeiro número (1.x → 2.x)? O "0." conta o segundo (0.107 → 0.108 não é major). */
export function isMajorJump(from: string, to: string): boolean {
  const a = cleanVersion(from)
    .split('.')
    .map((part) => parseInt(part, 10) || 0);
  const b = cleanVersion(to)
    .split('.')
    .map((part) => parseInt(part, 10) || 0);
  if ((a[0] ?? 0) === 0 && (b[0] ?? 0) === 0) return false;
  return (b[0] ?? 0) > (a[0] ?? 0);
}

const GB = 1024 ** 3;

export const formatGb = (bytes: number) => `${(bytes / GB).toFixed(1)} GB`;

/**
 * As caixas (`- [ ]`) de uma fase escrita nos documentos: as que estão debaixo de
 * um título com o nome dela ("## Antes de atualizar", "## Depois"…).
 */
function phasePoints(
  docs: { title: string; content: string }[],
  phase: RegExp,
): string[] {
  const points: string[] = [];
  for (const doc of docs) {
    let inPhase = false;
    for (const line of doc.content.split(/\r?\n/)) {
      const heading = /^#{1,6}\s+(.*)$/.exec(line);
      if (heading) {
        inPhase = phase.test(heading[1]);
        continue;
      }
      const box = /^\s*[-*]\s+\[[ xX]\]\s+(.*)$/.exec(line);
      if (box && inPhase) points.push(`${box[1].trim()} (${doc.title})`);
    }
  }
  return points;
}

/** Os pontos de "antes de atualizar" escritos nos documentos. */
export const beforePoints = (
  docs: { title: string; kind: string; content: string }[],
) => phasePoints(docs, /antes/i);

/** Os pontos do estudo escritos nos documentos (ex.: "## As regras do estudo"). */
export const studyPoints = (
  docs: { title: string; kind: string; content: string }[],
) => phasePoints(docs, /^(?!.*(antes|depois)).*estud/i);

/** Os pontos de "depois de atualizar" escritos nos documentos. */
export const afterPoints = (
  docs: { title: string; kind: string; content: string }[],
) => phasePoints(docs, /depois/i);

export const describeChecks = (checks: UpdateCheck[]) =>
  checks
    .map(
      (check) =>
        `${check.ok === null ? '➖' : check.ok ? '✅' : '❌'} ${check.point}${check.evidence ? ` — ${check.evidence}` : ''}${check.source === 'code' ? ' 🔒' : ''}`,
    )
    .join('\n');
