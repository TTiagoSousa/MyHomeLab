/** Minúsculas e sem acentos, para comparar "Atualização" com "atualizacao". */
export const normalizeText = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** As palavras de uma pesquisa (sem repetidas, com pelo menos 2 letras). */
export const searchWords = (search: string | undefined) =>
  [
    ...new Set(
      (search ?? '')
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 2),
    ),
  ].slice(0, 8);

/** Um pedaço do texto à volta da primeira palavra encontrada (para a lista). */
export function snippet(content: string, words: string[], size = 160): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  if (!words.length) return flat.slice(0, size);
  const haystack = normalizeText(flat);
  const index = words
    .map((word) => haystack.indexOf(normalizeText(word)))
    .filter((position) => position >= 0)
    .sort((a, b) => a - b)[0];
  if (index === undefined) return flat.slice(0, size);
  const start = Math.max(0, index - size / 3);
  return (
    (start > 0 ? '…' : '') +
    flat.slice(start, start + size) +
    (start + size < flat.length ? '…' : '')
  );
}

/** As palavras que identificam o que um documento está ligado ("CT 105 adguard" → "ct 105", "105", "adguard"). */
export function linkNeedles(label: string): string[] {
  const clean = normalizeText(label).replace(/[·|()\-–—:]/g, ' ');
  const needles = new Set<string>();
  const guest = /\b(ct|vm)\s*(\d{2,})\b/.exec(clean);
  if (guest) {
    needles.add(`${guest[1]} ${guest[2]}`);
    needles.add(`${guest[1]}${guest[2]}`);
  }
  for (const part of clean.split(/\s{2,}|,/)) {
    const phrase = part
      .replace(/\b(ct|vm)\s*\d+\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (phrase.length >= 4 && !COMMON_WORDS.has(phrase)) needles.add(phrase);
  }
  for (const word of clean.split(/\s+/)) {
    if (word.length >= 5 && !COMMON_WORDS.has(word)) needles.add(word);
  }
  return [...needles];
}

/** Palavras de nomes que aparecem em qualquer pedido e não identificam nada. */
const COMMON_WORDS = new Set([
  'servidor',
  'server',
  'assistant',
  'servico',
  'casa',
  'home',
  'principal',
]);

/** O texto contém a agulha como palavra (ou frase) inteira. */
export function mentions(text: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(text);
}
