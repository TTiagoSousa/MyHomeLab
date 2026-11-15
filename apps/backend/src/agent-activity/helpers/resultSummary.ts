const MAX_LENGTH = 280;

/**
 * O texto que um trabalho devolveu, encurtado para uma linha do registo: os
 * subagentes devolvem a resposta em texto e o Jarvis em { replyText }. Outros
 * trabalhos (ex: correr as regras de email) não têm texto e ficam sem resumo.
 */
export function resultSummary(result: unknown): string | null {
  const text =
    typeof result === 'string'
      ? result
      : typeof (result as { replyText?: unknown } | null)?.replyText ===
          'string'
        ? (result as { replyText: string }).replyText
        : null;
  if (!text?.trim()) return null;
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > MAX_LENGTH ? `${line.slice(0, MAX_LENGTH - 1)}…` : line;
}
