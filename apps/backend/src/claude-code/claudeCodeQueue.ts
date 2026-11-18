/**
 * A vez de cada trabalho no Claude Code: cada um lança processos `claude` (o agente e os
 * subagentes dele), que gastam centenas de MB. Por utilizador correm no máximo `max` ao
 * mesmo tempo; os outros esperam pela vez, pela ordem de chegada.
 *
 * Só entra na fila o trabalho de topo (ou o primeiro no Claude Code depois de um agente
 * na API): os subagentes de um trabalho que já tem vez correm dentro dela. Se esperassem,
 * um chefe à espera do subagente nunca largava a vez — ficava tudo preso.
 */
interface Line {
  running: number;
  waiting: (() => void)[];
}

const lines = new Map<string, Line>();

const lineOf = (key: string): Line => {
  let line = lines.get(key);
  if (!line) {
    line = { running: 0, waiting: [] };
    lines.set(key, line);
  }
  return line;
};

/** Corre `work` quando houver vez; a vez fica livre no fim, mesmo com erro. */
export async function inTurn<T>(
  key: string,
  max: number,
  work: () => Promise<T>,
): Promise<T> {
  const line = lineOf(key);
  const limit = Math.max(1, max);
  if (line.running >= limit) {
    await new Promise<void>((resolve) => line.waiting.push(resolve));
  } else {
    line.running += 1;
  }
  try {
    return await work();
  } finally {
    const next = line.waiting.shift();
    if (next) next();
    else line.running -= 1;
  }
}

/** Quantos correm e quantos esperam (para a página Definições → IA). */
export function turnState(key: string): { running: number; waiting: number } {
  const line = lines.get(key);
  return { running: line?.running ?? 0, waiting: line?.waiting.length ?? 0 };
}
