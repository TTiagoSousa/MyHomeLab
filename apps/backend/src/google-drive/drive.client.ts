/**
 * A API do Google Drive (v3): procurar, ler, descarregar, exportar, copiar, criar e as
 * versões de um ficheiro. Tudo com o token da conta ligada (ensureFreshAccessToken).
 * Nunca apaga nem partilha: isso não está aqui.
 */

import { GOOGLE_TIMEOUT_MS } from 'src/connected-account/google/google-oauth.client';

const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export const FOLDER = 'application/vnd.google-apps.folder';
export const GOOGLE_SHEET = 'application/vnd.google-apps.spreadsheet';
export const GOOGLE_DOC = 'application/vnd.google-apps.document';
export const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  trashed?: boolean;
  lastModifyingUser?: { displayName?: string; emailAddress?: string };
  owners?: { displayName?: string; emailAddress?: string }[];
}

export interface DriveRevision {
  id: string;
  modifiedTime: string;
  lastModifyingUser?: { displayName?: string; emailAddress?: string };
  exportLinks?: Record<string, string>;
}

/** O máximo que se descarrega ou exporta de uma vez (fica todo em memória). */
export const MAX_DOWNLOAD_MB = 20;
const MAX_DOWNLOAD = MAX_DOWNLOAD_MB * 1024 * 1024;

const FILE_FIELDS =
  'id,name,mimeType,parents,modifiedTime,size,webViewLink,trashed,lastModifyingUser(displayName,emailAddress),owners(displayName,emailAddress)';

async function call<T>(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    // Um erro pode vir em HTML (um proxy, um 502 do Google): fica o status e o início.
    let reason = text.slice(0, 200);
    try {
      reason =
        (JSON.parse(text || '{}') as { error?: { message?: string } }).error
          ?.message ?? reason;
    } catch {
      reason = `${response.statusText || 'erro'} (a resposta não é JSON)`;
    }
    throw new Error(
      response.status === 404
        ? 'esse ficheiro não existe no Drive (ou a conta não o vê)'
        : response.status === 403
          ? `o Google recusou (${reason}). Se for a primeira vez, confirma que a Drive API e a Sheets API estão ativas no projeto do Google Cloud.`
          : `o Google respondeu ${response.status}: ${reason}`,
    );
  }
  return response.json() as Promise<T>;
}

async function bytes(
  token: string,
  url: string,
): Promise<{ data: Buffer; type: string }> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    // Até 20 MB: o dobro do tempo dos outros pedidos (o corpo também conta).
    signal: AbortSignal.timeout(2 * GOOGLE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`o Google respondeu ${response.status} ao descarregar`);
  }
  // Tudo vai para a memória: um vídeo de gigas deitava o backend abaixo.
  const tooBig = () =>
    new Error(
      `o ficheiro passa de ${MAX_DOWNLOAD_MB} MB: grande demais para ler por aqui. Abre-o no Drive.`,
    );
  if (Number(response.headers.get('content-length') ?? 0) > MAX_DOWNLOAD) {
    await response.body?.cancel().catch(() => undefined);
    throw tooBig();
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body?.getReader();
  for (;;) {
    const chunk = reader ? await reader.read() : { done: true as const };
    if (chunk.done) break;
    total += chunk.value.length;
    if (total > MAX_DOWNLOAD) {
      await reader?.cancel().catch(() => undefined);
      throw tooBig();
    }
    chunks.push(chunk.value);
  }
  return {
    data: Buffer.concat(chunks),
    type: response.headers.get('content-type') ?? '',
  };
}

/** O id de um ficheiro a partir de um link do Drive ou das Folhas (ou o próprio id). */
export function driveFileId(value: string): string {
  const text = value.trim();
  const match =
    /\/(?:d|folders)\/([\w-]{10,})/.exec(text) ??
    /[?&]id=([\w-]{10,})/.exec(text);
  return match?.[1] ?? text;
}

export const getDriveFile = (token: string, id: string) =>
  call<DriveFile>(
    token,
    `${DRIVE}/files/${encodeURIComponent(id)}?fields=${FILE_FIELDS}&supportsAllDrives=true`,
  );

/** Procura no Drive (nome e conteúdo), dentro de uma pasta ou em todo. */
export async function searchDrive(
  token: string,
  options: {
    text?: string;
    folderId?: string;
    mimeType?: string;
    limit?: number;
  },
): Promise<DriveFile[]> {
  const escape = (value: string) =>
    value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const terms = ['trashed = false'];
  if (options.text) {
    const text = escape(options.text);
    terms.push(`(name contains '${text}' or fullText contains '${text}')`);
  }
  if (options.folderId) terms.push(`'${escape(options.folderId)}' in parents`);
  if (options.mimeType) terms.push(`mimeType = '${escape(options.mimeType)}'`);
  const params = new URLSearchParams({
    q: terms.join(' and '),
    fields: `files(${FILE_FIELDS})`,
    pageSize: String(Math.min(options.limit ?? 30, 100)),
    orderBy: options.text ? 'modifiedTime desc' : 'folder,name',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  const result = await call<{ files: DriveFile[] }>(
    token,
    `${DRIVE}/files?${params.toString()}`,
  );
  return result.files ?? [];
}

/** O conteúdo de um ficheiro normal (Excel, Word, PDF…). */
export const downloadDriveFile = (token: string, id: string) =>
  bytes(
    token,
    `${DRIVE}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`,
  );

/** Um ficheiro do Google (Docs, Folhas) exportado noutro formato. */
export const exportDriveFile = (token: string, id: string, mimeType: string) =>
  bytes(
    token,
    `${DRIVE}/files/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent(mimeType)}`,
  );

export async function listRevisions(
  token: string,
  id: string,
): Promise<DriveRevision[]> {
  const result = await call<{ revisions?: DriveRevision[] }>(
    token,
    `${DRIVE}/files/${encodeURIComponent(id)}/revisions?pageSize=200&fields=revisions(id,modifiedTime,lastModifyingUser(displayName,emailAddress),exportLinks)`,
  );
  return result.revisions ?? [];
}

/** Uma versão antiga exportada (nas Folhas do Google, em .xlsx). */
export const revisionContent = (token: string, link: string) =>
  bytes(token, link);

/** Uma cópia, opcionalmente convertida (ex.: um .xlsx para Folha do Google). */
export const copyDriveFile = (
  token: string,
  id: string,
  body: { name: string; mimeType?: string; parents?: string[] },
) =>
  call<DriveFile>(
    token,
    `${DRIVE}/files/${encodeURIComponent(id)}/copy?fields=${FILE_FIELDS}&supportsAllDrives=true`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

/** Um ficheiro novo: vazio (uma pasta, uma Folha ou um Doc do Google) ou com conteúdo (um upload). Sem parents fica na raiz. */
export async function createDriveFile(
  token: string,
  metadata: { name: string; mimeType: string; parents?: string[] },
  content?: { data: Buffer; mimeType: string },
): Promise<DriveFile> {
  if (!content) {
    return call<DriveFile>(
      token,
      `${DRIVE}/files?fields=${FILE_FIELDS}&supportsAllDrives=true`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      },
    );
  }
  const boundary = `myhomelab${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${content.mimeType}\r\n\r\n`,
    ),
    content.data,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  return call<DriveFile>(
    token,
    `${UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}&supportsAllDrives=true`,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    },
  );
}
