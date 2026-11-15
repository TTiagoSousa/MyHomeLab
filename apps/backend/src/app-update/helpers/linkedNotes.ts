/** As secções das notas que não interessam ao estudo (traduções, tarefas internas, repetidas). */
const NOISE_SECTIONS =
  /^- (Localization|Included for completeness|Already announced|.*without a feature or bug label)/i;

/** O endereço do ficheiro em texto: Codeberg (/src/ → /raw/) e GitHub (blob → raw). */
export const rawNotesUrl = (url: string) => {
  const github = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)$/.exec(
    url,
  );
  if (github)
    return `https://raw.githubusercontent.com/${github[1]}/${github[2]}`;
  return url.replace(
    /^(https:\/\/codeberg\.org\/[^/]+\/[^/]+)\/src\//,
    '$1/raw/',
  );
};

/** Tira o que só ocupa espaço: comentários escondidos, links dos PR por extenso e as secções de ruído. */
export const cleanNotes = (text: string) => {
  const lines = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(
      /\[PR\]\(https:\/\/\S+?\/pulls\/(\d+)\)(?: \(\[backported\]\(\S+?\)\))?: /g,
      '#$1 ',
    )
    .split(/\r?\n/);
  const kept: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (/^(- |#)/.test(line)) skipping = NOISE_SECTIONS.test(line);
    if (!skipping) kept.push(line);
  }
  return kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const ANNOUNCEMENT_MAX = 2_500;

/** O ficheiro .md das notas, quando a release só aponta para ele (com o texto da release à frente). */
async function notesFile(body: string): Promise<string> {
  const link =
    body.length < 1000
      ? /https:\/\/(?:codeberg\.org|github\.com)\/\S+?\.md\b/.exec(body)?.[0]
      : undefined;
  if (!link) return body;
  const response = await fetch(rawNotesUrl(link), {
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response?.ok) return body;
  // O que a release diz além do link (ex.: "não atualizem para já") fica à frente.
  const note = body
    .replace(/^\s*See\s+\S+\.md\s*$/im, '')
    .replace(/\s*\*{3}\s*$/, '')
    .trim();
  const file = cleanNotes(await response.text());
  return note ? `${note}\n\n${file}` : file;
}

/** Os anúncios de segurança para que a release aponta (issues de um repositório "security-…" no Codeberg). */
async function securityAnnouncements(body: string): Promise<string[]> {
  const links = [
    ...new Set(
      body.match(
        /https:\/\/codeberg\.org\/[^/\s]+\/[^/\s]*security[^/\s]*\/issues\/\d+/gi,
      ) ?? [],
    ),
  ].slice(0, 3);
  const texts = await Promise.all(
    links.map(async (link) => {
      const response = await fetch(
        link.replace(
          /^https:\/\/codeberg\.org\//,
          'https://codeberg.org/api/v1/repos/',
        ),
        { signal: AbortSignal.timeout(15_000) },
      ).catch(() => null);
      if (!response?.ok) return null;
      const issue = (await response.json()) as {
        title?: string;
        body?: string;
      };
      return `Anúncio de segurança (${link}): ${issue.title ?? ''}\n${(issue.body ?? '').slice(0, ANNOUNCEMENT_MAX)}`;
    }),
  );
  return texts.filter((text): text is string => Boolean(text));
}

/**
 * As notas de uma release, completas: em projetos onde a release só diz "See <ficheiro
 * .md>" (ex.: o Forgejo) lê-se esse ficheiro, limpo; os anúncios de segurança para que
 * aponta vêm à frente. Tudo cortado em `max` caracteres.
 */
export async function expandLinkedNotes(
  body: string,
  max: number,
): Promise<string> {
  const notes = await notesFile(body);
  const announcements = await securityAnnouncements(notes);
  const text = [...announcements, notes].join('\n\n');
  return text.length > max
    ? `${text.slice(0, max)}\n… (cortado; o resto está na release)`
    : text;
}
