export interface RecurringPhrase {
  phrase: string;
  emails: number;
  senders: number;
  example: string;
}

const MIN_EMAILS = 3;
const MAX_PHRASES = 20;

/** Palavras que sozinhas não dizem nada sobre o tipo de email. */
const STOPWORDS = new Set(
  [
    'a o as os de da do das dos e em no na nos nas um uma para por com que seu sua teu tua ao à',
    'the your you for to of and on in is an at with',
    'el la los las tu su y en del',
    're fw fwd',
  ]
    .join(' ')
    .split(' '),
);

const normalize = (word: string) =>
  word
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** As palavras do assunto, sem números, códigos nem pontuação. */
const wordsOf = (subject: string) =>
  subject
    .split(/[^\p{L}]+/u)
    .filter((word) => word.length > 1)
    .map((word) => ({ raw: word.toLowerCase(), key: normalize(word) }));

/**
 * As expressões de 2 a 3 palavras que se repetem nos assuntos — "código de
 * verificação", "your receipt", "fatura disponível". São o material das regras
 * por assunto ou palavra-chave, sobretudo quando o mesmo tipo de email vem de
 * vários remetentes. Uma expressão só conta uma vez por email.
 */
export function findRecurringSubjectPhrases(
  messages: { subject: string; sender: string }[],
): RecurringPhrase[] {
  const found = new Map<
    string,
    { phrase: string; emails: number; senders: Set<string>; example: string }
  >();

  for (const message of messages) {
    const words = wordsOf(message.subject);
    const seen = new Set<string>();
    for (let size = 2; size <= 3; size++) {
      for (let start = 0; start + size <= words.length; start++) {
        const slice = words.slice(start, start + size);
        if (STOPWORDS.has(slice[0].key) || STOPWORDS.has(slice[size - 1].key))
          continue;
        const key = slice.map((word) => word.key).join(' ');
        if (seen.has(key)) continue;
        seen.add(key);
        const entry = found.get(key) ?? {
          phrase: slice.map((word) => word.raw).join(' '),
          emails: 0,
          senders: new Set<string>(),
          example: message.subject,
        };
        entry.emails++;
        entry.senders.add(message.sender);
        found.set(key, entry);
      }
    }
  }

  const frequent = [...found.entries()].filter(
    ([, entry]) => entry.emails >= MIN_EMAILS,
  );
  // "código de" e "de verificação" saem quando "código de verificação" aparece nos mesmos emails.
  const kept = frequent.filter(
    ([key, entry]) =>
      !frequent.some(
        ([otherKey, other]) =>
          otherKey !== key &&
          otherKey.includes(key) &&
          other.emails >= entry.emails,
      ),
  );

  return kept
    .map(([, entry]) => ({
      phrase: entry.phrase,
      emails: entry.emails,
      senders: entry.senders.size,
      example: entry.example.slice(0, 120),
    }))
    .sort((a, b) => b.senders - a.senders || b.emails - a.emails)
    .slice(0, MAX_PHRASES);
}
