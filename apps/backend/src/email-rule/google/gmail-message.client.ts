import { GMAIL_API_BASE, gmailFetch } from './gmail-api.client';

/**
 * Um email inteiro (corpo e anexos), os rascunhos, o envio e o lixo. As regras só
 * precisam dos cabeçalhos (gmail-api.client); isto é para o assistente ler e
 * responder a um email concreto.
 */

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
}

interface GmailFullMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart;
}

export interface EmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface FullEmail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  cc: string;
  replyTo: string;
  subject: string;
  date: string;
  messageId: string;
  references: string;
  labelIds: string[];
  text: string;
  attachments: EmailAttachment[];
}

const auth = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

async function failed(response: Response, what: string): Promise<never> {
  const body = await response.text().catch(() => '');
  throw new Error(`${what}: ${response.status} ${body.slice(0, 200)}`.trim());
}

export const decodeBase64Url = (data: string) =>
  Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const encodeBase64Url = (data: Buffer) =>
  data
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** O HTML de um email como texto: sem estilos nem scripts, com as quebras de linha. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|table|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function walk(part: GmailPart | undefined, visit: (part: GmailPart) => void) {
  if (!part) return;
  visit(part);
  for (const child of part.parts ?? []) walk(child, visit);
}

/** O corpo em texto: o text/plain quando há, senão o HTML convertido. */
function bodyText(payload: GmailPart | undefined): string {
  const plain: string[] = [];
  const html: string[] = [];
  walk(payload, (part) => {
    if (part.filename || !part.body?.data) return;
    const text = decodeBase64Url(part.body.data).toString('utf8');
    if (part.mimeType === 'text/plain') plain.push(text);
    else if (part.mimeType === 'text/html') html.push(text);
  });
  if (plain.length) return plain.join('\n\n').trim();
  return htmlToText(html.join('\n'));
}

function attachmentsOf(payload: GmailPart | undefined): EmailAttachment[] {
  const found: EmailAttachment[] = [];
  walk(payload, (part) => {
    if (!part.filename || !part.body?.attachmentId) return;
    found.push({
      attachmentId: part.body.attachmentId,
      filename: part.filename,
      mimeType: part.mimeType ?? 'application/octet-stream',
      size: part.body.size ?? 0,
    });
  });
  return found;
}

export async function getFullMessage(
  accessToken: string,
  id: string,
): Promise<FullEmail> {
  const response = await gmailFetch(
    `${GMAIL_API_BASE}/messages/${encodeURIComponent(id)}?format=full`,
    { headers: auth(accessToken) },
  );
  if (!response.ok) await failed(response, 'Falha ao ler o email');
  const data = (await response.json()) as GmailFullMessage;
  const headers = data.payload?.headers ?? [];
  const value = (name: string) =>
    headers.find((header) => header.name.toLowerCase() === name.toLowerCase())
      ?.value ?? '';
  return {
    id: data.id,
    threadId: data.threadId,
    from: value('From'),
    to: value('To'),
    cc: value('Cc'),
    replyTo: value('Reply-To'),
    subject: value('Subject'),
    date: value('Date'),
    messageId: value('Message-ID'),
    references: value('References'),
    labelIds: data.labelIds ?? [],
    text: bodyText(data.payload) || data.snippet || '',
    attachments: attachmentsOf(data.payload),
  };
}

export async function getAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string,
): Promise<Buffer> {
  const response = await gmailFetch(
    `${GMAIL_API_BASE}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { headers: auth(accessToken) },
  );
  if (!response.ok) await failed(response, 'Falha ao ler o anexo');
  const data = (await response.json()) as { data?: string };
  return decodeBase64Url(data.data ?? '');
}

/** Um cabeçalho com acentos tem de ir codificado (RFC 2047). */
const encodeHeader = (value: string) =>
  /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;

const wrap76 = (base64: string) => base64.replace(/.{76}/g, '$&\r\n');

export interface OutgoingFile {
  filename: string;
  mimeType: string;
  data: Buffer;
}

export interface OutgoingEmail {
  to: string;
  cc?: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  references?: string;
  files?: OutgoingFile[];
}

/** O email em MIME (texto UTF-8 e, se houver, anexos), pronto para o "raw" do Gmail. */
export function buildRawEmail(email: OutgoingEmail): string {
  const head = [
    `To: ${email.to}`,
    ...(email.cc ? [`Cc: ${email.cc}`] : []),
    `Subject: ${encodeHeader(email.subject)}`,
    ...(email.inReplyTo ? [`In-Reply-To: ${email.inReplyTo}`] : []),
    ...(email.references ? [`References: ${email.references}`] : []),
    'MIME-Version: 1.0',
  ];
  const textPart = [
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(Buffer.from(email.text, 'utf8').toString('base64')),
  ];
  if (!email.files?.length) {
    return encodeBase64Url(
      Buffer.from([...head, ...textPart].join('\r\n'), 'utf8'),
    );
  }
  const boundary = `mhl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const parts = [
    `--${boundary}`,
    ...textPart,
    ...email.files.flatMap((file) => [
      `--${boundary}`,
      `Content-Type: ${file.mimeType}; name="${encodeHeader(file.filename)}"`,
      `Content-Disposition: attachment; filename="${encodeHeader(file.filename)}"`,
      'Content-Transfer-Encoding: base64',
      '',
      wrap76(file.data.toString('base64')),
    ]),
    `--${boundary}--`,
  ];
  return encodeBase64Url(
    Buffer.from(
      [
        ...head,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        ...parts,
      ].join('\r\n'),
      'utf8',
    ),
  );
}

export interface Draft {
  id: string;
  messageId: string;
  threadId: string;
}

export async function createDraft(
  accessToken: string,
  raw: string,
  threadId?: string,
): Promise<Draft> {
  const response = await gmailFetch(`${GMAIL_API_BASE}/drafts`, {
    method: 'POST',
    headers: { ...auth(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: { raw, ...(threadId ? { threadId } : {}) },
    }),
  });
  if (!response.ok) await failed(response, 'Falha ao criar o rascunho');
  const data = (await response.json()) as {
    id: string;
    message: { id: string; threadId: string };
  };
  return {
    id: data.id,
    messageId: data.message.id,
    threadId: data.message.threadId,
  };
}

/** O rascunho como está agora no Gmail (pode ter sido mudado à mão). */
export async function getDraft(
  accessToken: string,
  draftId: string,
): Promise<{ messageId: string } | null> {
  const response = await gmailFetch(
    `${GMAIL_API_BASE}/drafts/${encodeURIComponent(draftId)}?format=minimal`,
    { headers: auth(accessToken) },
  );
  if (response.status === 404) return null;
  if (!response.ok) await failed(response, 'Falha ao ler o rascunho');
  const data = (await response.json()) as { message: { id: string } };
  return { messageId: data.message.id };
}

export async function sendDraft(
  accessToken: string,
  draftId: string,
): Promise<{ id: string; threadId: string }> {
  const response = await gmailFetch(`${GMAIL_API_BASE}/drafts/send`, {
    method: 'POST',
    headers: { ...auth(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: draftId }),
  });
  if (!response.ok) await failed(response, 'Falha ao enviar o rascunho');
  return (await response.json()) as { id: string; threadId: string };
}

/** Para o lixo (o Gmail guarda-o 30 dias); não é apagar de vez. */
export async function trashMessage(
  accessToken: string,
  id: string,
): Promise<void> {
  const response = await gmailFetch(
    `${GMAIL_API_BASE}/messages/${encodeURIComponent(id)}/trash`,
    { method: 'POST', headers: auth(accessToken) },
  );
  if (!response.ok) await failed(response, 'Falha ao mandar para o lixo');
}

export async function untrashMessage(
  accessToken: string,
  id: string,
): Promise<void> {
  const response = await gmailFetch(
    `${GMAIL_API_BASE}/messages/${encodeURIComponent(id)}/untrash`,
    { method: 'POST', headers: auth(accessToken) },
  );
  if (!response.ok) await failed(response, 'Falha ao tirar do lixo');
}
