import { normalizeText } from 'src/docs/helpers/docText';

/** "Instagram da empresa" → "IE"; "Atualizações" → "ATU". Só letras e números, até 6. */
export function projectIdentifier(name: string, wanted?: string): string {
  const clean = (value: string) =>
    normalizeText(value)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  const own = clean(wanted ?? '').slice(0, 6);
  if (own) return own;
  // "da", "de", "do"… não contam para as iniciais.
  const words = normalizeText(name)
    .split(/[^a-z0-9]+/i)
    .filter((word) => word.length > 2 || /\d/.test(word));
  const initials = clean(words.map((word) => word[0]).join(''));
  if (initials.length >= 2) return initials.slice(0, 6);
  return clean(name).slice(0, 3) || 'TAR';
}

/** "ATU-12" */
export const taskKey = (identifier: string, number: number) =>
  `${identifier || 'TAR'}-${number}`;
