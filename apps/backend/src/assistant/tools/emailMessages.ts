import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { ensureFreshAccessToken } from 'src/connected-account/helpers/ensureFreshAccessToken';
import {
  listLabels,
  listMessageIds,
  loadLabelCache,
  modifyMessage,
  resolveLabelIds,
} from 'src/email-rule/google/gmail-api.client';
import {
  buildRawEmail,
  createDraft,
  getAttachment,
  getDraft,
  getFullMessage,
  sendDraft,
  trashMessage,
  untrashMessage,
  type FullEmail,
  type OutgoingFile,
} from 'src/email-rule/google/gmail-message.client';
import { LabelMode } from 'src/generated/prisma/client/client';
import type { AiClient } from 'src/ai-credential/ai-client';
import { createHash } from 'crypto';
import { docxText, xlsxText } from 'src/utils/office/officeText';
import { SUBAGENT_MODEL } from '../claude-agent.client';
import { resolveAccount } from './manageEmailRules';

/** O corpo de um email chega ao agente até aqui; o resto fica cortado (e diz-se). */
const MAX_BODY_CHARS = 20_000;
/** Um anexo de texto chega até aqui. */
const MAX_TEXT_ATTACHMENT_CHARS = 30_000;
/** O que a IA consegue ler de uma vez (PDF ou imagem). */
const MAX_AI_ATTACHMENT_BYTES = 15 * 1024 * 1024;
/** Os anexos reencaminhados, somados (o Gmail aceita 25 MB por email). */
const MAX_FORWARD_BYTES = 20 * 1024 * 1024;

type Repo = PrismaConnectedAccountRepository;

async function openAccount(
  accountEmail: string | undefined,
  repository: Repo,
  userId: string,
) {
  const account = await resolveAccount(accountEmail, repository, userId);
  const token = await ensureFreshAccessToken(account.id, repository);
  return { account, token };
}

const kb = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** A data do cabeçalho (que vem no fuso de quem enviou) na hora de Lisboa. */
const lisbonDate = (date: string) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(parsed);
};

// O Gmail devolve os marcadores pelo id (Label_123); o agente precisa do nome para ver
// que regra já tratou o email e se ainda está na caixa de entrada.
async function labelNames(
  token: string,
  labelIds: string[],
): Promise<string[]> {
  if (labelIds.length === 0) return [];
  const labels = await listLabels(token);
  const names = new Map(labels.map((label) => [label.id, label.name]));
  return labelIds.map((id) => names.get(id) ?? id);
}

function describeEmail(email: FullEmail, labels: string[]): string {
  const body =
    email.text.length > MAX_BODY_CHARS
      ? `${email.text.slice(0, MAX_BODY_CHARS)}\n\n[… cortado: o email tem ${email.text.length} caracteres]`
      : email.text;
  const attachments = email.attachments.length
    ? email.attachments
        .map(
          (file) => `- ${file.filename} (${file.mimeType}, ${kb(file.size)})`,
        )
        .join('\n')
    : 'nenhum';
  return [
    `messageId: ${email.id} · threadId: ${email.threadId}`,
    `De: ${email.from}`,
    `Para: ${email.to}`,
    ...(email.cc ? [`Cc: ${email.cc}`] : []),
    `Data: ${lisbonDate(email.date)} (hora de Lisboa)`,
    `Assunto: ${email.subject}`,
    `Na caixa de entrada: ${email.labelIds.includes('INBOX') ? 'sim' : 'não (arquivado)'}`,
    `Marcadores: ${labels.join(', ') || 'nenhum'}`,
    `Anexos:\n${attachments}`,
    '',
    body || '(sem texto)',
  ].join('\n');
}

export async function readEmail(
  input: { accountEmail?: string; messageId: string },
  repository: Repo,
  userId: string,
): Promise<string> {
  const { token } = await openAccount(input.accountEmail, repository, userId);
  const email = await getFullMessage(token, input.messageId);
  return describeEmail(email, await labelNames(token, email.labelIds));
}

const isText = (mimeType: string, filename: string) =>
  /^text\//.test(mimeType) ||
  /^application\/(json|xml|csv)|calendar/.test(mimeType) ||
  /\.(txt|csv|md|json|xml|ics|log)$/i.test(filename);

const isImage = (mimeType: string) =>
  /^image\/(png|jpe?g|gif|webp)$/.test(mimeType);

const isPdf = (mimeType: string, filename: string) =>
  mimeType === 'application/pdf' || /\.pdf$/i.test(filename);

const isWord = (mimeType: string, filename: string) =>
  /wordprocessingml/.test(mimeType) || /\.docx$/i.test(filename);

const isExcel = (mimeType: string, filename: string) =>
  /spreadsheetml/.test(mimeType) || /\.xlsx$/i.test(filename);

const cut = (text: string) =>
  text.length > MAX_TEXT_ATTACHMENT_CHARS
    ? `${text.slice(0, MAX_TEXT_ATTACHMENT_CHARS)}\n\n[… cortado]`
    : text;

/**
 * Os anexos de um email: um (pelo nome) ou, sem nome, todos. Texto, Word e Excel
 * leem-se no código; PDF e imagens pela IA (o conteúdo transcrito e um resumo).
 * Cada um leva a impressão digital (sha256): dois anexos com a mesma são o mesmo
 * ficheiro, mesmo em emails diferentes.
 */
export async function readEmailAttachment(
  input: {
    accountEmail?: string;
    messageId: string;
    attachmentId?: string;
    filename?: string;
  },
  repository: Repo,
  userId: string,
  ai: AiClient,
): Promise<string> {
  const { token } = await openAccount(input.accountEmail, repository, userId);
  const email = await getFullMessage(token, input.messageId);
  if (!email.attachments.length) return 'Este email não tem anexos.';
  const wanted =
    input.attachmentId || input.filename
      ? email.attachments.filter(
          (item) =>
            item.attachmentId === input.attachmentId ||
            (input.filename &&
              item.filename.toLowerCase() === input.filename.toLowerCase()),
        )
      : email.attachments;
  if (!wanted.length) {
    return `Esse anexo não está neste email. Os anexos são: ${email.attachments.map((item) => item.filename).join(', ')}.`;
  }
  const read: string[] = [];
  for (const file of wanted) {
    read.push(await readOneAttachment(token, email, file, ai));
  }
  return (
    `Email ${email.id} («${email.subject}»): ${read.length} anexo(s) lido(s).\n\n` +
    read.join('\n\n---\n\n')
  );
}

async function readOneAttachment(
  token: string,
  email: FullEmail,
  file: FullEmail['attachments'][number],
  ai: AiClient,
): Promise<string> {
  const data = await getAttachment(token, email.id, file.attachmentId);
  const fingerprint = createHash('sha256')
    .update(data)
    .digest('hex')
    .slice(0, 12);
  const head = `${file.filename} (${file.mimeType}, ${kb(data.length)}, sha256 ${fingerprint})`;

  if (
    isWord(file.mimeType, file.filename) ||
    isExcel(file.mimeType, file.filename)
  ) {
    try {
      const text = isWord(file.mimeType, file.filename)
        ? docxText(data)
        : xlsxText(data);
      return `${head}:\n\n${cut(text) || '(sem texto)'}`;
    } catch (error) {
      return `${head}: não consegui abrir o ficheiro (${error instanceof Error ? error.message : String(error)}).`;
    }
  }
  if (isText(file.mimeType, file.filename)) {
    return `${head}:\n\n${cut(data.toString('utf8'))}`;
  }
  const pdf = isPdf(file.mimeType, file.filename);
  if (!pdf && !isImage(file.mimeType)) {
    return `${head}: não consigo ler este formato (só texto, Word, Excel, PDF e imagens).`;
  }
  if (data.length > MAX_AI_ATTACHMENT_BYTES) {
    return `${head}: é grande demais para ler (máximo ${kb(MAX_AI_ATTACHMENT_BYTES)}).`;
  }

  const response = await ai.messages.create({
    model: SUBAGENT_MODEL,
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: [
          pdf
            ? {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: data.toString('base64'),
                },
              }
            : {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: file.mimeType as
                    'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
                  data: data.toString('base64'),
                },
              },
          {
            type: 'text',
            text:
              `Este é o anexo "${file.filename}" de um email com o assunto "${email.subject}". ` +
              'Em português europeu: primeiro um resumo de 3 a 6 linhas (o que é, datas, valores, ' +
              'prazos, o que pede), depois o conteúdo importante transcrito (tabelas como listas). ' +
              'Só o que está lá; não inventes.',
          },
        ],
      },
    ],
  });
  const text = response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();
  return `${head}:\n\n${text || '(a IA não devolveu texto)'}`;
}

const prefixed = (prefix: string, subject: string) =>
  new RegExp(`^${prefix}:`, 'i').test(subject.trim())
    ? subject
    : `${prefix}: ${subject}`;

const quote = (email: FullEmail) =>
  `\n\nEm ${email.date}, ${email.from} escreveu:\n` +
  email.text
    .split('\n')
    .slice(0, 60)
    .map((line) => `> ${line}`)
    .join('\n');

const addressesOf = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const emailOf = (address: string) =>
  (/<([^>]+)>/.exec(address)?.[1] ?? address).trim().toLowerCase();

export interface DraftInput {
  accountEmail?: string;
  mode: 'new' | 'reply' | 'forward';
  messageId?: string;
  to?: string;
  cc?: string;
  subject?: string;
  text: string;
  replyAll?: boolean;
  includeAttachments?: boolean;
}

/** O rascunho criado: o que o cartão do chat mostra antes de ele o mandar. */
export interface DraftCreated {
  accountEmail: string;
  draftId: string;
  mode: DraftInput['mode'];
  to: string;
  cc?: string;
  subject: string;
  text: string;
  attachments: string[];
  skipped: string[];
  /** Destinatários com quem a conta nunca trocou emails. */
  newRecipients: string[];
}

/** Quem nunca trocou emails com esta conta (o cartão avisa "endereço novo"). */
async function unknownRecipients(
  token: string,
  own: string,
  addresses: string[],
): Promise<string[]> {
  const unknown: string[] = [];
  for (const address of [...new Set(addresses.map(emailOf))]) {
    if (!address || address === own) continue;
    const seen = await listMessageIds(
      token,
      `from:${address} OR to:${address}`,
      1,
    ).catch(() => ['?']);
    if (!seen.length) unknown.push(address);
  }
  return unknown;
}

/**
 * Um rascunho no Gmail: novo, resposta (no mesmo fio) ou reencaminhado (com os
 * anexos do original). Não envia: só sai quando ele aprova o cartão do chat.
 * Devolve o rascunho, ou o que falta (texto para o modelo).
 */
export async function draftEmail(
  input: DraftInput,
  repository: Repo,
  userId: string,
): Promise<DraftCreated | string> {
  const { account, token } = await openAccount(
    input.accountEmail,
    repository,
    userId,
  );
  const own = (account.emailAddress ?? '').toLowerCase();
  if (!input.text?.trim()) return 'Falta o texto do email.';
  const created = async (
    draftId: string,
    to: string,
    subject: string,
    cc: string | undefined,
    attachments: string[] = [],
    skipped: string[] = [],
  ): Promise<DraftCreated> => ({
    accountEmail: account.emailAddress ?? own,
    draftId,
    mode: input.mode,
    to,
    cc,
    subject,
    text: input.text,
    attachments,
    skipped,
    newRecipients: await unknownRecipients(token, own, [
      ...addressesOf(to),
      ...addressesOf(cc ?? ''),
    ]),
  });

  if (input.mode === 'new') {
    if (!input.to?.trim() || !input.subject?.trim()) {
      return 'Um email novo precisa de destinatário (to) e assunto (subject).';
    }
    const draft = await createDraft(
      token,
      buildRawEmail({
        to: input.to,
        cc: input.cc,
        subject: input.subject,
        text: input.text,
      }),
    );
    return created(draft.id, input.to, input.subject, input.cc);
  }

  if (!input.messageId) return 'Falta o messageId do email original.';
  const original = await getFullMessage(token, input.messageId);
  const references = [original.references, original.messageId]
    .filter(Boolean)
    .join(' ');

  if (input.mode === 'reply') {
    const replyTo = original.replyTo || original.from;
    const others = input.replyAll
      ? [...addressesOf(original.to), ...addressesOf(original.cc)].filter(
          (address) =>
            emailOf(address) !== own && emailOf(address) !== emailOf(replyTo),
        )
      : [];
    const to = input.to?.trim() || replyTo;
    const cc = input.cc?.trim() || others.join(', ') || undefined;
    const subject = input.subject?.trim() || prefixed('Re', original.subject);
    const draft = await createDraft(
      token,
      buildRawEmail({
        to,
        cc,
        subject,
        text: `${input.text}${quote(original)}`,
        inReplyTo: original.messageId || undefined,
        references: references || undefined,
      }),
      original.threadId,
    );
    return created(draft.id, to, subject, cc);
  }

  if (!input.to?.trim()) return 'Para reencaminhar falta o destinatário (to).';
  const files: OutgoingFile[] = [];
  const skipped: string[] = [];
  if (input.includeAttachments !== false) {
    let total = 0;
    for (const file of original.attachments) {
      if (total + file.size > MAX_FORWARD_BYTES) {
        skipped.push(file.filename);
        continue;
      }
      const data = await getAttachment(token, original.id, file.attachmentId);
      total += data.length;
      files.push({ filename: file.filename, mimeType: file.mimeType, data });
    }
  }
  const subject = input.subject?.trim() || prefixed('Fwd', original.subject);
  const forwarded =
    `${input.text}\n\n---------- Mensagem reencaminhada ----------\n` +
    `De: ${original.from}\nData: ${original.date}\nAssunto: ${original.subject}\nPara: ${original.to}\n\n` +
    original.text;
  const draft = await createDraft(
    token,
    buildRawEmail({
      to: input.to,
      cc: input.cc,
      subject,
      text: forwarded,
      files,
    }),
  );
  return created(
    draft.id,
    input.to,
    subject,
    input.cc,
    files.map((file) => file.filename),
    skipped,
  );
}

/** O que o modelo lê depois de criar o rascunho. */
export function draftReport(draft: DraftCreated, approvalId?: string) {
  return (
    `Rascunho criado no Gmail (draftId: ${draft.draftId}). Ainda não foi enviado.\n` +
    `Para: ${draft.to}${draft.cc ? `\nCc: ${draft.cc}` : ''}\nAssunto: ${draft.subject}\n\n${draft.text}` +
    (draft.attachments.length
      ? `\n\nAnexos: ${draft.attachments.join(', ')}.`
      : '') +
    (draft.skipped.length
      ? `\nFicaram de fora por serem grandes demais: ${draft.skipped.join(', ')}.`
      : '') +
    (draft.newRecipients.length
      ? `\n⚠ Endereço novo (a conta nunca trocou emails com): ${draft.newRecipients.join(', ')}.`
      : '') +
    (approvalId
      ? `\n\nAparece-lhe um cartão no chat (${approvalId}) com este email e o botão Enviar: só sai quando ele carrega. Diz-lhe numa frase que o email está pronto no cartão.`
      : '\n\nFica nos Rascunhos do Gmail: num disparo não se envia, ele envia-o de lá se quiser. Diz-lho no aviso.')
  );
}

/** Envia um rascunho. Só o ChatApprovalService o chama, depois do sim dele. */
export async function sendEmailDraft(
  input: { accountEmail?: string; draftId: string },
  repository: Repo,
  userId: string,
): Promise<string> {
  const { token } = await openAccount(input.accountEmail, repository, userId);
  const draft = await getDraft(token, input.draftId);
  if (!draft) {
    return 'Esse rascunho já não existe (foi enviado ou apagado no Gmail).';
  }
  const sent = await sendDraft(token, input.draftId);
  return `Enviado (messageId: ${sent.id}).`;
}

export interface ModifyInput {
  accountEmail?: string;
  messageIds: string[];
  addLabels?: string[];
  removeLabels?: string[];
  archive?: boolean;
  inbox?: boolean;
  read?: boolean;
  starred?: boolean;
  important?: boolean;
}

/** Mexer em emails concretos: marcadores, arquivar ou voltar à caixa, lido, estrela, importante. */
export async function modifyEmails(
  input: ModifyInput,
  repository: Repo,
  userId: string,
): Promise<string> {
  const ids = (input.messageIds ?? []).filter(Boolean).slice(0, 100);
  if (!ids.length) return 'Falta o messageId (ou a lista messageIds).';
  const { token } = await openAccount(input.accountEmail, repository, userId);

  const cache =
    input.addLabels?.length || input.removeLabels?.length
      ? await loadLabelCache(token)
      : new Map<string, string>();
  const add: string[] = [];
  const remove: string[] = [];
  for (const path of input.addLabels ?? []) {
    add.push(
      ...(await resolveLabelIds(token, path, LabelMode.ALL_LEVELS, cache)),
    );
  }
  const missing: string[] = [];
  for (const path of input.removeLabels ?? []) {
    const id = cache.get(path.trim().toLowerCase());
    if (id) remove.push(id);
    else missing.push(path);
  }
  const flag = (value: boolean | undefined, label: string, onAdds = true) => {
    if (value === undefined) return;
    (value === onAdds ? add : remove).push(label);
  };
  if (input.archive) remove.push('INBOX');
  if (input.inbox) add.push('INBOX');
  flag(input.read, 'UNREAD', false);
  flag(input.starred, 'STARRED');
  flag(input.important, 'IMPORTANT');

  if (!add.length && !remove.length) {
    return missing.length
      ? `Esses marcadores não existem: ${missing.join(', ')}.`
      : 'Não disseste o que mudar.';
  }
  for (const id of ids) {
    await modifyMessage(token, id, {
      addLabelIds: add,
      removeLabelIds: remove,
    });
  }
  return (
    `Feito em ${ids.length} email(s).` +
    (missing.length
      ? ` Não existem (ficaram de fora): ${missing.join(', ')}.`
      : '')
  );
}

export async function trashEmails(
  input: { accountEmail?: string; messageIds: string[]; restore?: boolean },
  repository: Repo,
  userId: string,
): Promise<string> {
  const ids = (input.messageIds ?? []).filter(Boolean).slice(0, 100);
  if (!ids.length) return 'Falta o messageId (ou a lista messageIds).';
  const { token } = await openAccount(input.accountEmail, repository, userId);
  for (const id of ids) {
    if (input.restore) await untrashMessage(token, id);
    else await trashMessage(token, id);
  }
  return input.restore
    ? `Tirei ${ids.length} email(s) do lixo.`
    : `Mandei ${ids.length} email(s) para o lixo (o Gmail guarda-os 30 dias; dá para os tirar de lá com restore).`;
}
