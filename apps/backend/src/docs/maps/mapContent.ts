// O texto dos mapas automáticos: o que o MyHomeLab sabe de um servidor ou de uma app,
// em Markdown, com uma secção "Notas" que é do utilizador e dos agentes e nunca se reescreve.

/** A etiqueta que marca um mapa gerado (o título pode mudar; a etiqueta não). */
export const MAP_TAG = 'mapa-auto';
export const NOTES_HEADING = '## Notas';

const NOTES_PLACEHOLDER =
  '_O que só tu sabes desta coisa (para que serve, cuidados, contactos). O MyHomeLab nunca mexe nesta secção._';

const FREQUENCIES: Record<string, string> = {
  EVERY_15_MINUTES: 'de 15 em 15 minutos',
  EVERY_30_MINUTES: 'de 30 em 30 minutos',
  HOURLY: 'de hora a hora',
  EVERY_2_HOURS: 'de 2 em 2 horas',
  EVERY_4_HOURS: 'de 4 em 4 horas',
  EVERY_6_HOURS: 'de 6 em 6 horas',
  EVERY_8_HOURS: 'de 8 em 8 horas',
  DAILY: 'uma vez por dia',
  WEEKLY: 'uma vez por semana',
};

export const frequencyText = (value: string | null | undefined) =>
  value ? (FREQUENCIES[value] ?? value) : 'desligada';

export const day = (date: Date) =>
  date.toLocaleDateString('pt-PT', { timeZone: 'Europe/Lisbon' });

export const dateTime = (date: Date) =>
  date.toLocaleString('pt-PT', {
    timeZone: 'Europe/Lisbon',
    dateStyle: 'short',
    timeStyle: 'short',
  });

export const gigabytes = (bytes: number | undefined) =>
  bytes
    ? `${(bytes / 1024 ** 3).toFixed(bytes >= 10 * 1024 ** 3 ? 0 : 1)} GB`
    : '—';

export const count = (value: number) => value.toLocaleString('pt-PT');

const HEADER = [
  '> Gerado pelo MyHomeLab com o que ele sabe e refeito sozinho todos os dias.',
  '> Escreve só na secção **Notas**: o resto é reescrito.',
].join('\n');

/**
 * O mapa inteiro: o título, o aviso, as secções geradas e as Notas que já lá estavam
 * (ou o espaço para elas, num mapa novo).
 */
export function withNotes(
  title: string,
  sections: string[],
  existing?: string | null,
): string {
  const at = existing ? existing.indexOf(NOTES_HEADING) : -1;
  const notes =
    existing && at >= 0
      ? existing.slice(at).trim()
      : `${NOTES_HEADING}\n\n${NOTES_PLACEHOLDER}`;
  return [`# ${title}`, HEADER, ...sections.filter(Boolean), notes].join(
    '\n\n',
  );
}

/** Uma secção "## Título" com uma lista; vazia quando não há nada para dizer. */
export function section(
  heading: string,
  lines: (string | null | false | undefined)[],
) {
  const items = lines.filter((line): line is string => Boolean(line));
  if (items.length === 0) return '';
  return [`## ${heading}`, '', ...items].join('\n');
}

/**
 * Os marcadores do Gmail em árvore, por baixo do de topo: "Saúde: Oli, Oli/Veterinário
 * especial, Rex". Só os do utilizador (os do sistema têm ids como INBOX).
 */
export function labelTree(names: string[]): string[] {
  const groups = new Map<string, string[]>();
  for (const name of [...names].sort((a, b) => a.localeCompare(b, 'pt'))) {
    const [top, ...rest] = name.split('/');
    const children = groups.get(top) ?? [];
    if (rest.length) children.push(rest.join('/'));
    groups.set(top, children);
  }
  return [...groups.entries()].map(([top, children]) =>
    children.length ? `- **${top}:** ${children.join(', ')}` : `- **${top}**`,
  );
}

/** Uma tabela Markdown; vazia quando não há linhas. */
export function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '';
  const escape = (cell: string) => cell.replace(/\|/g, '\\|');
  return [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => '---').join('|')}|`,
    ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`),
  ].join('\n');
}
