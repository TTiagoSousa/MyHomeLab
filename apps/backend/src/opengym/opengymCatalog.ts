import { OPENGYM_REPOSITORY } from './opengym.client';

/** Um exercício do catálogo do openGym (o formato compacto que a app usa). */
export interface OpenGymExercise {
  id: string;
  /** Nome em inglês. */
  n: string;
  /** Parte do corpo: chest, back, upper legs, … */
  bp: string;
  /** Equipamento: barbell, dumbbell, body weight, … */
  eq: string;
  /** Músculo alvo. */
  tg: string;
  sm?: string[];
  /** strength, cardio, stretching, … */
  cat?: string;
  /** Só se segura (prancha, wall sit): entra numa rotina como tempo. */
  hold?: boolean;
  /** O nome em português, quando o catálogo o tem. */
  pt?: string;
}

const CACHE_MS = 24 * 60 * 60_000;
const cache = new Map<string, { at: number; list: OpenGymExercise[] }>();

const raw = (ref: string, path: string) =>
  `https://raw.githubusercontent.com/${OPENGYM_REPOSITORY}/${ref}/${path}`;

/**
 * O valor de uma constante de um ficheiro JS gerado, sem o correr: `X=JSON.parse('…')`
 * (as versões novas) ou `X=[…]` em JSON puro (as antigas, até à 1.4.2).
 */
export function jsonLiteral(source: string, name: string): unknown {
  const plain = `export const ${name}=`;
  const at = source.indexOf(plain);
  if (at >= 0 && source[at + plain.length] !== 'J') {
    const next = source.indexOf('\nexport ', at + plain.length);
    return JSON.parse(
      source
        .slice(at + plain.length, next < 0 ? undefined : next)
        .trim()
        .replace(/;$/, ''),
    );
  }
  const marker = `export const ${name}=JSON.parse('`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`o catálogo não tem ${name}`);
  let out = '';
  for (let index = start + marker.length; index < source.length; index++) {
    const char = source[index];
    if (char === "'") return JSON.parse(out);
    if (char !== '\\') {
      out += char;
      continue;
    }
    const next = source[++index];
    if (next === 'n') out += '\n';
    else if (next === 't') out += '\t';
    else if (next === 'r') out += '\r';
    else if (next === 'u') {
      out += String.fromCharCode(
        parseInt(source.slice(index + 1, index + 5), 16),
      );
      index += 4;
    } else if (next === 'x') {
      out += String.fromCharCode(
        parseInt(source.slice(index + 1, index + 3), 16),
      );
      index += 2;
    } else out += next;
  }
  throw new Error(`o ${name} do catálogo não acaba`);
}

async function text(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${response.status} em ${url}`);
  return response.text();
}

/**
 * O catálogo da versão instalada (o mesmo que a app traz), lido ao GitHub do
 * openGym e guardado um dia. Sem a versão, ou sem a etiqueta, vale o do main.
 */
export async function openGymCatalog(
  version: string | null,
): Promise<OpenGymExercise[]> {
  const ref = version ? `v${version.replace(/^v/, '')}` : 'main';
  const cached = cache.get(ref);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.list;

  const source = await text(
    raw(ref, 'frontend/src/lib/exercises-data.js'),
  ).catch((error) => {
    if (ref === 'main') throw error;
    return text(raw('main', 'frontend/src/lib/exercises-data.js'));
  });
  const list = jsonLiteral(source, 'EXDB') as OpenGymExercise[];
  // Os nomes em português são mais recentes do que algumas versões: sem eles na etiqueta, os do main.
  const names: Record<string, { name?: string } | undefined> = await text(
    raw(ref, 'catalogue/i18n/pt.json'),
  )
    .catch(() => text(raw('main', 'catalogue/i18n/pt.json')))
    .then((body) => JSON.parse(body) as Record<string, { name?: string }>)
    .catch(() => ({}));
  for (const exercise of list) {
    const pt = names[exercise.id]?.name;
    if (pt) exercise.pt = pt;
  }
  cache.set(ref, { at: Date.now(), list });
  return list;
}

const fold = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Procura no catálogo: todas as palavras têm de aparecer (no nome em inglês ou em português). */
export function searchCatalog(
  list: OpenGymExercise[],
  filters: {
    query?: string;
    bodyPart?: string;
    equipment?: string;
    category?: string;
    limit?: number;
  },
): OpenGymExercise[] {
  const words = fold(filters.query ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const bodyPart = filters.bodyPart && fold(filters.bodyPart);
  const equipment = filters.equipment && fold(filters.equipment);
  const category = filters.category && fold(filters.category);
  return list
    .filter((exercise) => {
      if (bodyPart && fold(exercise.bp) !== bodyPart) return false;
      if (equipment && fold(exercise.eq) !== equipment) return false;
      if (category && fold(exercise.cat ?? '') !== category) return false;
      const haystack = fold(
        `${exercise.n} ${exercise.pt ?? ''} ${exercise.tg} ${exercise.eq}`,
      );
      return words.every((word) => haystack.includes(word));
    })
    .sort((a, b) => a.n.length - b.n.length)
    .slice(0, Math.min(Math.max(filters.limit ?? 20, 1), 50));
}
