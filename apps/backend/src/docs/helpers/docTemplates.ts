import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  ConnectionProvider,
  DocKind,
} from 'src/generated/prisma/client/client';

// Os conjuntos de documentos prontos (templates/docs no repositório): os que vêm com a
// versão instalada e, por cima, os que a comunidade juntou ao main — assim um conjunto
// novo aparece sem atualizar a app. Sem rede, ficam os da versão instalada.

const REMOTE =
  'https://raw.githubusercontent.com/TTiagoSousa/MyHomeLab/main/templates/docs';
const REMOTE_TIMEOUT_MS = 5000;
const KINDS: DocKind[] = [DocKind.RULES, DocKind.MAP];
const PROVIDERS = Object.values(ConnectionProvider) as string[];

type Texts = Partial<Record<'pt-PT' | 'en' | 'es', string>>;

export interface TemplateSet {
  id: string;
  author: string;
  language: string;
  name: Texts;
  description: Texts;
  files: string[];
}

export interface TemplateDoc {
  title: string;
  kind: DocKind;
  tags: string[];
  summary?: string;
  apps: ConnectionProvider[];
  agents: string[];
  server: boolean;
  content: string;
}

/** A pasta dos modelos: no CT, a da app (APP_DIR); em desenvolvimento, a raiz do repositório. */
const localDir = () =>
  join(
    process.env.APP_DIR ?? resolve(process.cwd(), '..', '..'),
    'templates',
    'docs',
  );

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,40}$/;
const SAFE_FILE = /^[a-z0-9][a-z0-9-]{0,80}\.md$/;

async function remote(path: string): Promise<string | null> {
  try {
    const response = await fetch(`${REMOTE}/${path}`, {
      signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS),
    });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

async function local(path: string): Promise<string | null> {
  try {
    return await readFile(join(localDir(), path), 'utf8');
  } catch {
    return null;
  }
}

const parseIndex = (text: string | null): TemplateSet[] => {
  if (!text) return [];
  try {
    const sets = (JSON.parse(text) as { sets?: TemplateSet[] }).sets ?? [];
    return sets.filter(
      (set) =>
        SAFE_ID.test(set.id) &&
        Array.isArray(set.files) &&
        set.files.every((file) => SAFE_FILE.test(file)),
    );
  } catch {
    return [];
  }
};

/** Os conjuntos: os da versão instalada e os do main (os do main ganham quando o id é igual). */
export async function listTemplateSets(): Promise<TemplateSet[]> {
  const [installed, published] = await Promise.all([
    local('index.json'),
    remote('index.json'),
  ]);
  const sets = new Map<string, TemplateSet>();
  for (const set of [...parseIndex(installed), ...parseIndex(published)]) {
    sets.set(set.id, set);
  }
  return [...sets.values()];
}

const list = (value: string | undefined) =>
  (value ?? '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/** Um ficheiro de modelo: o cabeçalho (--- chave: valor ---) e o Markdown. */
export function parseTemplate(text: string): TemplateDoc | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!match) return null;
  const meta = new Map<string, string>();
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^(\w+):\s*(.*?)\s*(#.*)?$/.exec(line);
    if (pair) meta.set(pair[1], pair[2]);
  }
  const title = meta.get('title')?.trim();
  const kind = meta.get('kind') as DocKind;
  if (!title || !KINDS.includes(kind)) return null;
  return {
    title: title.slice(0, 160),
    kind,
    tags: list(meta.get('tags')).slice(0, 20),
    summary: meta.get('summary')?.slice(0, 300),
    apps: list(meta.get('apps')).filter((app) =>
      PROVIDERS.includes(app),
    ) as ConnectionProvider[],
    agents: list(meta.get('agents')),
    server: meta.get('server') === 'true',
    content: match[2].trim(),
  };
}

/** Os documentos de um conjunto (da versão instalada ou, se lá não houver, do main). */
export async function loadTemplateSet(
  id: string,
): Promise<{ set: TemplateSet; docs: TemplateDoc[] } | null> {
  const set = (await listTemplateSets()).find((item) => item.id === id);
  if (!set) return null;
  const docs: TemplateDoc[] = [];
  for (const file of set.files) {
    const path = `${set.id}/${file}`;
    const text = (await local(path)) ?? (await remote(path));
    const doc = text ? parseTemplate(text) : null;
    if (doc) docs.push(doc);
  }
  return { set, docs };
}
