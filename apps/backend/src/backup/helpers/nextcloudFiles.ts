import { randomUUID } from 'crypto';
import { Agent } from 'https';
import { Readable } from 'stream';
import axios, { AxiosRequestConfig } from 'axios';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

/**
 * Sem fim, um pedido pendurado no Nextcloud parava todos os backups (correm um de
 * cada vez). Um pedaço tem 10 minutos; juntar os pedaços de um ficheiro grande, 30.
 */
const PUT_TIMEOUT_MS = 10 * 60_000;
const MOVE_TIMEOUT_MS = 30 * 60_000;

export interface NextcloudFile {
  name: string;
  sizeBytes: number | null;
}

export interface NextcloudAccount {
  userId: string;
  displayName: string | null;
  freeBytes: number | null;
}

const PROPFIND_BODY =
  '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getcontentlength/><d:resourcetype/></d:prop></d:propfind>';

/** 10 MB, como o cliente do Nextcloud: passa nos limites dos proxies habituais. */
const CHUNK_BYTES = 10 * 1024 * 1024;

/** Parte um stream em Buffers de `size` bytes (o último pode ser mais pequeno). */
async function* chunksOf(content: Readable, size: number) {
  let parts: Buffer[] = [];
  let length = 0;
  for await (const data of content) {
    let piece = Buffer.isBuffer(data) ? data : Buffer.from(data as string);
    while (length + piece.length >= size) {
      const take = size - length;
      parts.push(piece.subarray(0, take));
      yield Buffer.concat(parts);
      piece = piece.subarray(take);
      parts = [];
      length = 0;
    }
    if (piece.length) {
      parts.push(piece);
      length += piece.length;
    }
  }
  if (length) yield Buffer.concat(parts);
}

const encodePath = (path: string) =>
  path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

/** Junta pastas ("backups", "Adguard") num caminho sem barras a mais. */
export const joinPath = (...parts: string[]) =>
  parts
    .flatMap((part) => part.split('/'))
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/');

/**
 * Os ficheiros de um Nextcloud por WebDAV, com uma password de app. O
 * utilizador real (o id do WebDAV pode não ser o login, ex: email) vem da API
 * OCS. Certificados self-signed aceites, como nos outros serviços da LAN.
 */
export function createNextcloudFiles(
  baseUrl: string,
  username: string,
  password: string,
) {
  const http = axios.create({
    baseURL: baseUrl.trim().replace(/\/+$/, ''),
    auth: { username, password },
    httpsAgent: new Agent({ rejectUnauthorized: false }),
    timeout: 30_000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  async function request<T>(
    config: AxiosRequestConfig,
    acceptStatus: number[] = [],
  ) {
    try {
      return await http.request<T>({
        ...config,
        validateStatus: (status) =>
          (status >= 200 && status < 300) || acceptStatus.includes(status),
      });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : null;
      if (status === 401) {
        throw new AppIntegrationError(
          'APP_AUTH_FAILED',
          'O Nextcloud recusou o utilizador ou a password de app.',
        );
      }
      if (status === 507) {
        throw new AppIntegrationError(
          'APP_UNREACHABLE',
          'O Nextcloud não tem espaço para guardar o backup.',
        );
      }
      const detail = axios.isAxiosError(error)
        ? error.response
          ? `respondeu ${error.response.status}`
          : error.message
        : String(error);
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        `Não foi possível falar com o Nextcloud: ${detail}`,
      );
    }
  }

  const davPath = (userId: string, path: string) =>
    `/remote.php/dav/files/${encodeURIComponent(userId)}/${encodePath(path)}`;

  async function account(): Promise<NextcloudAccount> {
    const response = await request<{
      ocs?: {
        data?: {
          id?: string;
          displayname?: string;
          quota?: { free?: number };
        };
      };
    }>({
      method: 'GET',
      url: '/ocs/v2.php/cloud/user?format=json',
      headers: { 'OCS-APIRequest': 'true' },
    });
    const data = response.data?.ocs?.data;
    if (!data?.id) {
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        'Este endereço não parece ser um Nextcloud.',
      );
    }
    const free = data.quota?.free;
    return {
      userId: data.id,
      displayName: data.displayname ?? null,
      freeBytes: typeof free === 'number' && free >= 0 ? free : null,
    };
  }

  /** Diz se o caminho existe e é uma pasta. */
  async function isFolder(userId: string, path: string) {
    const response = await request<string>(
      {
        method: 'PROPFIND',
        url: `${davPath(userId, path)}/`,
        data: PROPFIND_BODY,
        headers: { Depth: '0', 'Content-Type': 'application/xml' },
        responseType: 'text',
      },
      [404],
    );
    return (
      response.status !== 404 &&
      /<(?:\w+:)?collection\s*\/>/i.test(String(response.data))
    );
  }

  /**
   * Cria a pasta e as de cima que faltarem, uma a uma (405 = já existe). No
   * fim confirma que a pasta está lá — um 405 também pode ser um ficheiro com
   * o mesmo nome, e aí o backup nunca entraria.
   */
  async function ensureFolder(userId: string, path: string) {
    const segments = path.split('/').filter(Boolean);
    for (let index = 1; index <= segments.length; index += 1) {
      const current = segments.slice(0, index).join('/');
      const response = await request(
        { method: 'MKCOL', url: davPath(userId, current) },
        [405, 409],
      );
      if (response.status === 409) {
        throw new AppIntegrationError(
          'APP_UNREACHABLE',
          `O Nextcloud não deixou criar a pasta /${current}.`,
        );
      }
    }
    if (segments.length && !(await isFolder(userId, path))) {
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        `Não foi possível criar a pasta /${path} no Nextcloud (já existe um ficheiro com esse nome?).`,
      );
    }
  }

  /**
   * Grava um ficheiro. Até CHUNK_BYTES vai num só PUT; acima disso vai aos
   * pedaços (upload por chunks do Nextcloud), porque o proxy à frente do
   * Nextcloud (nginx, Cloudflare) recusa pedidos grandes com 413.
   */
  async function upload(
    userId: string,
    path: string,
    content: Buffer | Readable,
    sizeBytes?: number | null,
  ) {
    const size = Buffer.isBuffer(content) ? content.length : sizeBytes;
    if (size != null && size <= CHUNK_BYTES) {
      await request({
        method: 'PUT',
        url: davPath(userId, path),
        data: content,
        timeout: PUT_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(size),
        },
      });
      return;
    }
    await uploadChunked(
      userId,
      path,
      Buffer.isBuffer(content) ? Readable.from([content]) : content,
      size,
    );
  }

  /**
   * Chunks v2: cria uma pasta temporária em /uploads, manda os pedaços
   * numerados (00001, 00002…) e no fim um MOVE de `.file` junta-os no destino.
   * Se algo falhar, a pasta temporária é apagada.
   */
  async function uploadChunked(
    userId: string,
    path: string,
    content: Readable,
    sizeBytes?: number | null,
  ) {
    const uploadUrl = `/remote.php/dav/uploads/${encodeURIComponent(userId)}/myhomelab-${randomUUID()}`;
    const destination = webdavUrl(userId, path);
    await request({
      method: 'MKCOL',
      url: uploadUrl,
      headers: { Destination: destination },
    });

    try {
      let index = 0;
      for await (const chunk of chunksOf(content, CHUNK_BYTES)) {
        index += 1;
        await request({
          method: 'PUT',
          url: `${uploadUrl}/${String(index).padStart(5, '0')}`,
          data: chunk,
          timeout: PUT_TIMEOUT_MS,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Length': String(chunk.length),
            Destination: destination,
            ...(sizeBytes ? { 'OC-Total-Length': String(sizeBytes) } : {}),
          },
        });
      }
      await request({
        method: 'MOVE',
        url: `${uploadUrl}/.file`,
        timeout: MOVE_TIMEOUT_MS,
        headers: {
          Destination: destination,
          Overwrite: 'T',
          ...(sizeBytes ? { 'OC-Total-Length': String(sizeBytes) } : {}),
        },
      });
    } catch (error) {
      await request({ method: 'DELETE', url: uploadUrl }, [404]).catch(
        () => undefined,
      );
      throw error;
    }
  }

  /** O endereço WebDAV de uma pasta, como outras apps (ex: o HA) o pedem. */
  const webdavUrl = (userId: string, path = '') =>
    `${baseUrl.trim().replace(/\/+$/, '')}${davPath(userId, path)}`;

  /** Os ficheiros (não as pastas) que estão diretamente dentro de uma pasta. */
  async function list(
    userId: string,
    folder: string,
  ): Promise<NextcloudFile[]> {
    const response = await request<string>(
      {
        method: 'PROPFIND',
        url: `${davPath(userId, folder)}/`,
        data: PROPFIND_BODY,
        headers: { Depth: '1', 'Content-Type': 'application/xml' },
        responseType: 'text',
      },
      [404],
    );
    if (response.status === 404) return [];

    const responses = String(response.data)
      .split(/<(?:\w+:)?response>/i)
      .slice(1);
    return responses
      .filter((block) => !/<(?:\w+:)?collection\s*\/>/i.test(block))
      .map((block) => {
        const href =
          block.match(/<(?:\w+:)?href>([^<]+)<\/(?:\w+:)?href>/i)?.[1] ?? '';
        const size = block.match(
          /<(?:\w+:)?getcontentlength>(\d+)<\/(?:\w+:)?getcontentlength>/i,
        )?.[1];
        return {
          name: decodeURIComponent(
            href.replace(/\/+$/, '').split('/').pop() ?? '',
          ),
          sizeBytes: size ? Number(size) : null,
        };
      })
      .filter((file) => file.name);
  }

  async function remove(userId: string, path: string) {
    await request({ method: 'DELETE', url: davPath(userId, path) }, [404]);
  }

  return { account, ensureFolder, isFolder, upload, list, remove, webdavUrl };
}
