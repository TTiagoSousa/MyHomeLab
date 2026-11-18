import { randomUUID } from 'crypto';
import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import {
  StirlingFile,
  StirlingOperation,
  createStirlingClient,
} from 'src/stirling/stirling.client';
import { createPaperlessClient } from 'src/paperless/paperless.client';
import { createNextcloudFiles } from 'src/backup/helpers/nextcloudFiles';
import { paperlessTarget } from './paperlessTools';
import { nextcloudTarget } from './nextcloudTools';

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const hostOf = (url: string | null) => {
  try {
    return url ? new URL(url).host : '?';
  } catch {
    return '?';
  }
};

const accountLabel = (account: ConnectedAccount) =>
  `${account.displayName ?? 'Stirling-PDF'} (${hostOf(account.baseUrl)})`;

const describeError = (error: unknown) =>
  error instanceof AppIntegrationError || error instanceof Error
    ? error.message
    : String(error);

export const safely = async (work: () => Promise<string>) => {
  try {
    return await work();
  } catch (error) {
    return `Falhou: ${describeError(error)}`;
  }
};

const size = (bytes: number) =>
  bytes >= 1024 ** 2
    ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** O Stirling-PDF a usar: o único, ou o que bate com o nome ou o endereço pedido. */
export async function stirlingTarget(
  repository: PrismaConnectedAccountRepository,
  userId: string,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await repository.findAllByUser(userId, ConnectionProvider.STIRLING_PDF)
  ).filter(
    (account) => account.isActive && account.baseUrl && account.accessToken,
  );
  if (!accounts.length) {
    return 'Não há nenhum Stirling-PDF ligado. Liga-o em Apps ligadas → Stirling-PDF.';
  }
  const matches = wanted?.trim()
    ? accounts.filter((account) =>
        normalize(accountLabel(account)).includes(normalize(wanted)),
      )
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o Stirling-PDF: ${accounts.map(accountLabel).join(', ')}.`;
  }
  return matches[0];
}

const clientOf = (account: ConnectedAccount) =>
  createStirlingClient(account.baseUrl ?? '', account.accessToken ?? '');

// ── Os resultados guardados (para encadear operações) ─────────────────────

const RESULT_TTL_MS = 2 * 60 * 60_000;
const RESULTS_PER_USER = 20;
interface KeptResult {
  file: StirlingFile;
  createdAt: number;
  from: string;
}

const results = new Map<string, Map<string, KeptResult>>();

function keep(userId: string, file: StirlingFile, from: string): string {
  const mine = results.get(userId) ?? new Map<string, KeptResult>();
  results.set(userId, mine);
  const now = Date.now();
  for (const [id, entry] of mine) {
    if (now - entry.createdAt > RESULT_TTL_MS) mine.delete(id);
  }
  while (mine.size >= RESULTS_PER_USER) {
    mine.delete(mine.keys().next().value as string);
  }
  const id = `r-${randomUUID().slice(0, 8)}`;
  mine.set(id, { file, createdAt: now, from });
  return id;
}

const kept = (userId: string, id: string) => {
  const entry = results.get(userId)?.get(id.trim());
  return entry && Date.now() - entry.createdAt <= RESULT_TTL_MS ? entry : null;
};

export function listResults(userId: string): string {
  const mine = [...(results.get(userId)?.entries() ?? [])].filter(
    ([, entry]) => Date.now() - entry.createdAt <= RESULT_TTL_MS,
  );
  if (!mine.length) return 'Não há resultados guardados (ficam 2 horas).';
  return mine
    .map(
      ([id, entry]) =>
        `${id}: ${entry.file.name} (${size(entry.file.data.length)}) — de ${entry.from}`,
    )
    .join('\n');
}

// ── O que se vê ───────────────────────────────────────────────────────────

let cachedOps: { at: number; key: string; ops: StirlingOperation[] } | null =
  null;

async function operationsOf(account: ConnectedAccount) {
  const key = `${account.id}:${account.appVersion ?? ''}`;
  if (
    cachedOps &&
    cachedOps.key === key &&
    Date.now() - cachedOps.at < 3_600_000
  ) {
    return cachedOps.ops;
  }
  const ops = await clientOf(account).operations();
  cachedOps = { at: Date.now(), key, ops };
  return ops;
}

export async function overview(account: ConnectedAccount): Promise<string> {
  const client = clientOf(account);
  const [status, ops, disabled, mcp] = await Promise.all([
    client.status(),
    operationsOf(account),
    client.disabledEndpoints().catch(() => null),
    client.mcpTools(),
  ]);
  const byTag = new Map<string, number>();
  for (const op of ops) byTag.set(op.tag, (byTag.get(op.tag) ?? 0) + 1);
  const off = disabled
    ? Object.entries(disabled)
        .filter(([, enabled]) => enabled === false)
        .map(([name]) => name)
    : [];
  return [
    `${accountLabel(account)}: ${status.status}, versão ${status.version}${account.appLatestVersion ? ` (há a ${account.appLatestVersion})` : ''}.`,
    `Operações: ${ops.length} — ${[...byTag].map(([tag, count]) => `${tag} ${count}`).join(', ')}.`,
    off.length
      ? `Desligadas no servidor: ${off.slice(0, 30).join(', ')}.`
      : 'Nenhuma operação desligada no servidor.',
    mcp
      ? `MCP: ligado (${mcp.length} ferramentas em ${clientOf(account).mcpUrl()}).`
      : 'MCP: não está ligado neste servidor (mcp.enabled) ou é da versão paga.',
    'Para correr: stirling_operations para encontrar, stirling_describe para os parâmetros e stirling_run com os ficheiros (Paperless, Nextcloud ou um resultado anterior).',
  ].join('\n');
}

export async function listOperations(
  account: ConnectedAccount,
  search?: string,
): Promise<string> {
  const ops = await operationsOf(account);
  const words = normalize(search ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const found = words.length
    ? ops.filter((op) => {
        const text = normalize(
          `${op.path} ${op.tag} ${op.summary} ${op.description ?? ''}`,
        );
        return words.every((word) => text.includes(word));
      })
    : ops;
  if (!found.length)
    return `Nenhuma operação com "${search}". Tenta outra palavra (ex.: compress, ocr, merge, split, convert).`;
  return [
    `${found.length} operações${search ? ` com "${search}"` : ''}:`,
    ...found.slice(0, 120).map((op) => `- ${op.path} — ${op.summary}`),
  ].join('\n');
}

export async function describeOperation(
  account: ConnectedAccount,
  path: string,
): Promise<string> {
  const op = (await operationsOf(account)).find(
    (entry) => entry.path === path.trim().replace(/^\/?(api\/v1\/)?/, ''),
  );
  if (!op)
    return `Não há a operação "${path}". Vê a lista com stirling_operations.`;
  return [
    `${op.path} — ${op.summary}`,
    op.description ? op.description : '',
    'Parâmetros:',
    ...op.parameters.map((param) =>
      [
        `- ${param.name}${param.required ? ' (obrigatório)' : ''}: ${param.file ? (param.file.many ? 'ficheiros' : 'ficheiro') : param.type}`,
        param.enum?.length ? `valores: ${param.enum.join(', ')}` : '',
        param.default !== undefined
          ? `por omissão ${JSON.stringify(param.default)}`
          : '',
        param.description ? `— ${param.description}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    ),
  ]
    .filter(Boolean)
    .join('\n');
}

// ── Correr uma operação ───────────────────────────────────────────────────

export interface StirlingInput {
  /** O campo de ficheiro (sem isto, o primeiro da operação). */
  field?: string;
  paperless_id?: number;
  paperless?: string;
  /** No Paperless: o original em vez do arquivado (com OCR). */
  original?: boolean;
  nextcloud_path?: string;
  nextcloud?: string;
  /** Um resultado anterior (r-xxxxxxxx). */
  result?: string;
}

export interface StirlingSave {
  paperless?: { title?: string; account?: string };
  nextcloud?: { path: string; account?: string };
}

async function nextcloudFiles(
  repository: PrismaConnectedAccountRepository,
  userId: string,
  wanted?: string,
) {
  const account = await nextcloudTarget(repository, userId, wanted);
  if (typeof account === 'string') throw new Error(account);
  const base = (account.baseUrl ?? account.caldavUrl ?? '')
    .replace(/\/remote\.php\/.*$/i, '')
    .replace(/\/+$/, '');
  const files = createNextcloudFiles(
    base,
    account.caldavUsername ?? '',
    account.caldavPassword ?? '',
  );
  const { userId: davUser } = await files.account();
  return { files, davUser };
}

async function loadInput(
  repository: PrismaConnectedAccountRepository,
  userId: string,
  input: StirlingInput,
): Promise<{ file: StirlingFile; from: string }> {
  if (input.result) {
    const entry = kept(userId, input.result);
    if (!entry)
      throw new Error(
        `O resultado ${input.result} já não existe (ficam 2 horas).`,
      );
    return { file: entry.file, from: input.result };
  }
  if (input.paperless_id) {
    const account = await paperlessTarget(repository, userId, input.paperless);
    if (typeof account === 'string') throw new Error(account);
    const file = await createPaperlessClient(
      account.baseUrl ?? '',
      account.accessToken ?? '',
    ).download(input.paperless_id, input.original === true);
    return { file, from: `Paperless #${input.paperless_id}` };
  }
  if (input.nextcloud_path) {
    const { files, davUser } = await nextcloudFiles(
      repository,
      userId,
      input.nextcloud,
    );
    const path = input.nextcloud_path.replace(/^\/+/, '');
    const { data, contentType } = await files.download(davUser, path);
    return {
      file: {
        name: path.split('/').pop() || 'ficheiro.pdf',
        data,
        contentType,
      },
      from: `Nextcloud /${path}`,
    };
  }
  throw new Error(
    'Cada ficheiro vem de paperless_id, nextcloud_path ou result.',
  );
}

const SECRET =
  /pass(word)?|secret|api.?key|token|private|credential|premium\.key/i;

export async function runOperation(
  account: ConnectedAccount,
  repository: PrismaConnectedAccountRepository,
  userId: string,
  input: {
    operation: string;
    inputs?: StirlingInput[];
    parameters?: Record<string, unknown>;
    save?: StirlingSave;
  },
): Promise<string> {
  const path = input.operation.trim().replace(/^\/?(api\/v1\/)?/, '');
  const op = (await operationsOf(account)).find((entry) => entry.path === path);
  if (!op)
    return `Não há a operação "${input.operation}". Vê a lista com stirling_operations.`;
  const fileParams = op.parameters.filter((param) => param.file);
  const inputs = input.inputs ?? [];
  if (fileParams.length && !inputs.length) {
    return `${op.path} precisa de ${fileParams.map((param) => param.name).join(', ')}: passa os ficheiros em inputs (paperless_id, nextcloud_path ou result).`;
  }
  const files: { field: string; file: StirlingFile }[] = [];
  const from: string[] = [];
  for (const item of inputs) {
    const field = item.field ?? fileParams[0]?.name ?? 'fileInput';
    const param = fileParams.find((entry) => entry.name === field);
    if (
      param &&
      !param.file?.many &&
      files.some((entry) => entry.field === field)
    ) {
      return `${field} só aceita um ficheiro: corre a operação uma vez por ficheiro (ou usa uma que junte, ex.: general/merge-pdfs).`;
    }
    const loaded = await loadInput(repository, userId, item);
    files.push({ field, file: loaded.file });
    from.push(loaded.from);
  }
  const fields = { ...(input.parameters ?? {}) };
  const missing = op.parameters.filter(
    (param) =>
      param.required &&
      !param.file &&
      fields[param.name] === undefined &&
      param.default === undefined,
  );
  if (missing.length) {
    return `Faltam parâmetros obrigatórios de ${op.path}: ${missing.map((param) => param.name).join(', ')} (vê com stirling_describe).`;
  }
  const result = await clientOf(account).run(op.path, fields, files);
  if (result.kind === 'text') {
    return `${op.path} respondeu:\n${result.text}`;
  }
  const label = `${op.path} de ${from.join(' + ') || 'nada'}`;
  const id = keep(userId, result.file, label);
  const lines = [
    `Feito: ${result.file.name} (${size(result.file.data.length)}${files[0] ? `; antes ${size(files[0].file.data.length)}` : ''}). Guardado como ${id} durante 2 horas (usa-o como input noutra operação).`,
  ];
  if (input.save?.paperless) {
    const target = await paperlessTarget(
      repository,
      userId,
      input.save.paperless.account,
    );
    if (typeof target === 'string')
      return `${lines[0]}\nNão guardei no Paperless: ${target}`;
    const task = await createPaperlessClient(
      target.baseUrl ?? '',
      target.accessToken ?? '',
    ).upload(result.file, input.save.paperless.title);
    lines.push(
      `Enviado para o Paperless como um documento novo (tarefa ${String(task)}); o original ficou como estava.`,
    );
  }
  if (input.save?.nextcloud) {
    const { files: dav, davUser } = await nextcloudFiles(
      repository,
      userId,
      input.save.nextcloud.account,
    );
    const target = input.save.nextcloud.path.replace(/^\/+/, '');
    const folder = target.split('/').slice(0, -1).join('/');
    if (folder) await dav.ensureFolder(davUser, folder);
    await dav.upload(davUser, target, result.file.data);
    lines.push(`Gravado no Nextcloud em /${target}.`);
  }
  return lines.join('\n');
}

// ── Definições do servidor ────────────────────────────────────────────────

const masked = (value: unknown, key = ''): unknown => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([child, inner]) => [
        child,
        masked(inner, child),
      ]),
    );
  }
  return SECRET.test(key) && value ? '••••' : value;
};

export async function readSettings(
  account: ConnectedAccount,
  section?: string,
): Promise<string> {
  const client = clientOf(account);
  const [settings, pending] = await Promise.all([
    client.settings(section?.trim() || undefined),
    client.pendingSettings().catch(() => null),
  ]);
  const text = JSON.stringify(masked(settings), null, 2).slice(0, 14_000);
  return [
    section ? `Definições (${section}):` : 'Definições do Stirling-PDF:',
    text,
    pending && Object.keys(pending).length
      ? `À espera de reiniciar: ${JSON.stringify(masked(pending)).slice(0, 2000)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function changeSettings(
  account: ConnectedAccount,
  input: { settings: Record<string, unknown>; confirm?: boolean },
): Promise<string> {
  const entries = Object.entries(input.settings ?? {});
  if (!entries.length)
    return 'Diz as definições a mudar, em notação de pontos (ex.: { "system.defaultLocale": "pt_PT" }).';
  const secret = entries.filter(([key]) => SECRET.test(key));
  if (secret.length) {
    return `Não mexo em segredos (${secret.map(([key]) => key).join(', ')}): muda-os tu no Stirling-PDF.`;
  }
  const client = clientOf(account);
  if (!input.confirm) {
    const before = await Promise.all(
      entries.map(async ([key]) => {
        const sectionName = key.split('.')[0];
        const section = await client.settings(sectionName).catch(() => null);
        const value = key
          .split('.')
          .slice(1)
          .reduce<unknown>(
            (current, part) =>
              current && typeof current === 'object'
                ? (current as Record<string, unknown>)[part]
                : undefined,
            section,
          );
        return `- ${key}: ${JSON.stringify(value)} → ${JSON.stringify(input.settings[key])}`;
      }),
    );
    return [
      'Isto muda as definições do servidor Stirling-PDF (valem depois de reiniciar):',
      ...before,
      'Confirma com ele e chama outra vez com confirm: true.',
    ].join('\n');
  }
  await client.updateSettings(input.settings);
  return `Gravado: ${entries.map(([key]) => key).join(', ')}. As mudanças valem depois de reiniciar o Stirling-PDF.`;
}
