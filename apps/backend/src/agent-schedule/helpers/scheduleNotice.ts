/**
 * O que o agente pediu para avisar: o texto depois da linha "AVISO:" no fim da
 * resposta (até ao fim). Sem essa linha, não há novidades.
 */
export function scheduleNotice(reply: string): string | null {
  const lines = reply.split('\n');
  const index = lines.findLastIndex((line) =>
    /^\s*\**\s*AVISO\s*:/i.test(line),
  );
  if (index < 0) return null;
  const text = [
    lines[index].replace(/^\s*\**\s*AVISO\s*:\s*\**\s*/i, ''),
    ...lines.slice(index + 1),
  ]
    .join('\n')
    .trim();
  return text || null;
}
