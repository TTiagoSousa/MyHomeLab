import { EmailRule, LabelMode } from 'src/generated/prisma/client/client';
import { RunScope } from '../dto/run-email-rule.dto';
import { GOOGLE_TIMEOUT_MS } from 'src/connected-account/google/google-oauth.client';

export const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

const MAX_RETRIES = 4;
const BASE_RETRY_DELAY_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * O Gmail limita pedidos por utilizador e por segundo, e devolve 429 quando se
 * passa — ou 403 com o motivo rateLimitExceeded / userRateLimitExceeded, que foi
 * o que apareceu ao ler umas centenas de emails seguidos na análise da caixa. Em vez de deixar o erro subir, espera-se e repete-se — é o que a
 * documentação do Google recomenda. Respeita o Retry-After quando ele vem.
 */
async function isRateLimited(response: Response): Promise<boolean> {
  const body = await response
    .clone()
    .text()
    .catch(() => '');
  return /rateLimitExceeded|userRateLimitExceeded|quotaExceeded/i.test(body);
}

export async function gmailFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
    });

    const retryable =
      response.status === 429 ||
      response.status >= 500 ||
      (response.status === 403 && (await isRateLimited(response)));
    if (!retryable || attempt >= MAX_RETRIES) return response;

    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : BASE_RETRY_DELAY_MS * 2 ** attempt,
    );
  }
}

function quoteIfNeeded(value: string): string {
  return /\s/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

/**
 * Uma palavra-chave como a caixa de pesquisa do Gmail a entende: várias palavras sem
 * aspas têm de aparecer todas, por qualquer ordem — `(a b c)`; entre aspas é a frase
 * exata, seguida. Antes ia sempre entre aspas, e "Permitiu que a app acedesse…" não
 * apanhava o email que dizia "Permitiu que a app <o teu domínio> acedesse…".
 */
function keywordTerm(value: string): string {
  const trimmed = value.trim();
  if (/^".+"$/.test(trimmed)) return trimmed;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length > 1 ? `(${words.join(' ')})` : (words[0] ?? '');
}

function orGroup(operator: string, values: string[]): string | null {
  if (values.length === 0) return null;
  const terms = values.map((value) => `${operator}:${quoteIfNeeded(value)}`);
  return terms.length === 1 ? terms[0] : `(${terms.join(' OR ')})`;
}

export function buildGmailQuery(rule: EmailRule, scope: RunScope): string {
  const clauses: string[] = [];

  // A pesquisa do Gmail não percebe regex: `from:^.*@amazon\.com$` devolvia zero emails e a
  // regra "corria sem erro" e nunca apanhava nada. Com REGEX, remetente e assunto ficam
  // fora da pesquisa (vêm os candidatos da caixa, até ao limite por regra) e o padrão é
  // testado email a email no runEmailRules. Nota: com a lógica ANY e palavras-chave, as
  // palavras-chave continuam a filtrar a pesquisa, por isso passam a ser obrigatórias.
  if (rule.matchType !== 'REGEX') {
    const fromClause = orGroup('from', rule.fromContains);
    if (fromClause) clauses.push(fromClause);

    const subjectClause = orGroup('subject', rule.subjectContains);
    if (subjectClause) clauses.push(subjectClause);
  }

  const keywords = rule.keywords.map(keywordTerm).filter(Boolean);
  if (keywords.length > 0) {
    clauses.push(
      keywords.length === 1 ? keywords[0] : `(${keywords.join(' OR ')})`,
    );
  }

  let query =
    clauses.length === 0
      ? ''
      : rule.conditionLogic === 'ANY' && clauses.length > 1
        ? `(${clauses.join(' OR ')})`
        : clauses.join(' ');

  for (const excluded of rule.excludeKeywords
    .map(keywordTerm)
    .filter(Boolean)) {
    query += ` -${excluded}`;
  }

  if (rule.hasAttachment === true) query += ' has:attachment';
  if (rule.hasAttachment === false) query += ' -has:attachment';

  if (scope === 'INBOX') query += ' in:inbox';

  return query.trim();
}

interface GmailMessageListResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

export interface MessageRef {
  id: string;
  threadId: string;
}

export async function listMessageIds(
  accessToken: string,
  query: string,
  cap: number,
): Promise<string[]> {
  const refs = await listMessageRefs(accessToken, query, cap);
  return refs.map((ref) => ref.id);
}

/** Como o listMessageIds, mas com a conversa (threadId) de cada mensagem. */
export async function listMessageRefs(
  accessToken: string,
  query: string,
  cap: number,
): Promise<MessageRef[]> {
  const ids: MessageRef[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      maxResults: String(Math.min(100, cap - ids.length)),
    });
    if (query) params.set('q', query);
    if (pageToken) params.set('pageToken', pageToken);

    const response = await gmailFetch(
      `${GMAIL_API_BASE}/messages?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      throw new Error(`Falha ao listar mensagens Gmail: ${response.status}`);
    }

    const data = (await response.json()) as GmailMessageListResponse;
    for (const message of data.messages ?? []) {
      ids.push({ id: message.id, threadId: message.threadId });
      if (ids.length >= cap) break;
    }

    pageToken = ids.length < cap ? data.nextPageToken : undefined;
  } while (pageToken);

  return ids;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessageMetadata {
  id: string;
  payload?: { headers?: GmailHeader[] };
}

export interface MessageHeaders {
  from: string;
  subject: string;
  /**
   * Enviado em massa: traz List-Id ("lista de correio" no Gmail), List-Unsubscribe
   * ("cancelar a subscrição") ou Precedence: bulk/list. É o que separa a publicidade
   * de uma empresa dos emails da conta, quando ambos vêm do mesmo endereço.
   */
  isBulk: boolean;
}

export async function getMessageHeaders(
  accessToken: string,
  id: string,
): Promise<MessageHeaders> {
  const params = new URLSearchParams({ format: 'metadata' });
  params.append('metadataHeaders', 'From');
  params.append('metadataHeaders', 'Subject');
  params.append('metadataHeaders', 'List-Id');
  params.append('metadataHeaders', 'List-Unsubscribe');
  params.append('metadataHeaders', 'Precedence');

  const response = await gmailFetch(
    `${GMAIL_API_BASE}/messages/${id}?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    throw new Error(`Falha ao obter mensagem Gmail: ${response.status}`);
  }

  const data = (await response.json()) as GmailMessageMetadata;
  const headers = data.payload?.headers ?? [];

  // Os nomes dos cabeçalhos não distinguem maiúsculas (há quem envie "List-ID").
  const value = (name: string) =>
    headers.find((header) => header.name.toLowerCase() === name.toLowerCase())
      ?.value ?? '';

  return {
    from: value('From'),
    subject: value('Subject'),
    isBulk:
      Boolean(value('List-Id').trim()) ||
      Boolean(value('List-Unsubscribe').trim()) ||
      /^(bulk|list)$/i.test(value('Precedence').trim()),
  };
}

interface GmailMessageOverviewResponse {
  id: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: { headers?: GmailHeader[] };
}

/** Os cabeçalhos de uma mensagem mais o estado: por ler, na caixa de entrada, a data. */
export interface MessageOverview extends MessageHeaders {
  id: string;
  unread: boolean;
  inInbox: boolean;
  receivedAt: Date | null;
  /** Quantos marcadores criados pelo utilizador tem (os do sistema não contam). */
  userLabels: number;
}

/** Para a análise da caixa (assistente): o mesmo pedido de metadados, com etiquetas e data. */
export async function getMessageOverview(
  accessToken: string,
  id: string,
): Promise<MessageOverview> {
  const params = new URLSearchParams({ format: 'metadata' });
  for (const name of [
    'From',
    'Subject',
    'List-Id',
    'List-Unsubscribe',
    'Precedence',
  ]) {
    params.append('metadataHeaders', name);
  }

  const response = await gmailFetch(
    `${GMAIL_API_BASE}/messages/${id}?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new Error(`Falha ao obter mensagem Gmail: ${response.status}`);
  }

  const data = (await response.json()) as GmailMessageOverviewResponse;
  const headers = data.payload?.headers ?? [];
  const value = (name: string) =>
    headers.find((header) => header.name.toLowerCase() === name.toLowerCase())
      ?.value ?? '';
  const labels = data.labelIds ?? [];

  return {
    id,
    from: value('From'),
    subject: value('Subject'),
    isBulk:
      Boolean(value('List-Id').trim()) ||
      Boolean(value('List-Unsubscribe').trim()) ||
      /^(bulk|list)$/i.test(value('Precedence').trim()),
    unread: labels.includes('UNREAD'),
    inInbox: labels.includes('INBOX'),
    receivedAt: data.internalDate ? new Date(Number(data.internalDate)) : null,
    userLabels: labels.filter((label) => label.startsWith('Label_')).length,
  };
}

interface GmailMessageSnippet {
  id: string;
  snippet?: string;
  payload?: { headers?: GmailHeader[] };
}

export interface MessageSummary {
  from: string;
  subject: string;
  snippet: string;
}

export async function getMessageSnippet(
  accessToken: string,
  id: string,
): Promise<MessageSummary> {
  const params = new URLSearchParams({ format: 'metadata' });
  params.append('metadataHeaders', 'From');
  params.append('metadataHeaders', 'Subject');
  params.append('metadataHeaders', 'List-Id');
  params.append('metadataHeaders', 'List-Unsubscribe');
  params.append('metadataHeaders', 'Precedence');

  const response = await gmailFetch(
    `${GMAIL_API_BASE}/messages/${id}?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    throw new Error(`Falha ao obter mensagem Gmail: ${response.status}`);
  }

  const data = (await response.json()) as GmailMessageSnippet;
  const headers = data.payload?.headers ?? [];

  return {
    from: headers.find((header) => header.name === 'From')?.value ?? '',
    subject: headers.find((header) => header.name === 'Subject')?.value ?? '',
    snippet: data.snippet ?? '',
  };
}

interface GmailLabel {
  id: string;
  name: string;
}

interface GmailLabelListResponse {
  labels?: GmailLabel[];
}

export async function listLabels(accessToken: string): Promise<GmailLabel[]> {
  const response = await gmailFetch(`${GMAIL_API_BASE}/labels`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Falha ao listar labels Gmail: ${response.status}`);
  }

  const data = (await response.json()) as GmailLabelListResponse;
  return data.labels ?? [];
}

export async function createLabel(
  accessToken: string,
  name: string,
): Promise<GmailLabel> {
  const response = await gmailFetch(`${GMAIL_API_BASE}/labels`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    }),
  });

  // O Gmail devolve 409 quando o nome colide com uma label existente. As colisões não
  // são literais: os nomes são únicos ignorando maiúsculas, e criar "Pai/Filho" cria o
  // "Pai" implicitamente. Quem chama precisa de distinguir este caso dos outros erros.
  if (response.status === 409) {
    throw new GmailLabelConflictError(name);
  }

  if (!response.ok) {
    throw new Error(`Falha ao criar label Gmail "${name}": ${response.status}`);
  }

  return response.json() as Promise<GmailLabel>;
}

export class GmailLabelConflictError extends Error {
  constructor(readonly labelName: string) {
    super(`A label Gmail "${labelName}" já existe com outro nome equivalente`);
    this.name = 'GmailLabelConflictError';
  }
}

/**
 * A cache é indexada pelo nome normalizado, não pelo nome tal como está escrito. No
 * Gmail "Bancos" e "bancos" são a mesma label, portanto uma regra escrita com outra
 * capitalização tem de encontrar a que já existe em vez de tentar criar uma segunda.
 */
export type LabelCache = Map<string, string>;

function labelKey(name: string): string {
  return name.trim().toLowerCase();
}

export async function loadLabelCache(accessToken: string): Promise<LabelCache> {
  const labels = await listLabels(accessToken);
  return new Map(labels.map((label) => [labelKey(label.name), label.id]));
}

export async function resolveLabelIds(
  accessToken: string,
  path: string,
  labelMode: LabelMode,
  cache: LabelCache,
): Promise<string[]> {
  const segments = path
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return [];

  const namesToResolve =
    labelMode === 'ALL_LEVELS'
      ? segments.map((_, index) => segments.slice(0, index + 1).join('/'))
      : [segments.join('/')];

  const ids: string[] = [];
  for (const name of namesToResolve) {
    let id = cache.get(labelKey(name));
    if (!id) {
      id = await createOrAdoptLabel(accessToken, name, cache);
      cache.set(labelKey(name), id);
    }
    ids.push(id);
  }

  return ids;
}

/**
 * Um 409 aqui não é uma falha: quer dizer que a label já existe sob um nome que o
 * Gmail considera equivalente ao pedido. Nesse caso recarrega-se a lista e adota-se a
 * que lá está, em vez de deixar o erro rebentar a corrida toda das regras.
 */
async function createOrAdoptLabel(
  accessToken: string,
  name: string,
  cache: LabelCache,
): Promise<string> {
  try {
    const created = await createLabel(accessToken, name);
    return created.id;
  } catch (error) {
    if (!(error instanceof GmailLabelConflictError)) throw error;

    const refreshed = await loadLabelCache(accessToken);
    for (const [key, value] of refreshed) cache.set(key, value);

    const adopted = cache.get(labelKey(name));
    if (!adopted) throw error;
    return adopted;
  }
}

export async function modifyMessage(
  accessToken: string,
  id: string,
  changes: { addLabelIds?: string[]; removeLabelIds?: string[] },
): Promise<void> {
  if (!changes.addLabelIds?.length && !changes.removeLabelIds?.length) return;

  const response = await gmailFetch(`${GMAIL_API_BASE}/messages/${id}/modify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(changes),
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao atualizar mensagem Gmail ${id}: ${response.status}`,
    );
  }
}

export interface ThreadMessage {
  id: string;
  labelIds: string[];
}

/** As mensagens de uma conversa, só com as etiquetas de cada uma. */
export async function getThreadMessages(
  accessToken: string,
  threadId: string,
): Promise<ThreadMessage[]> {
  const response = await gmailFetch(
    `${GMAIL_API_BASE}/threads/${threadId}?format=minimal`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    throw new Error(
      `Falha ao ler a conversa Gmail ${threadId}: ${response.status}`,
    );
  }
  const data = (await response.json()) as {
    messages?: { id: string; labelIds?: string[] }[];
  };
  return (data.messages ?? []).map((message) => ({
    id: message.id,
    labelIds: message.labelIds ?? [],
  }));
}

export async function modifyThread(
  accessToken: string,
  threadId: string,
  changes: { removeLabelIds: string[] },
): Promise<void> {
  const response = await gmailFetch(
    `${GMAIL_API_BASE}/threads/${threadId}/modify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(changes),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Falha ao atualizar a conversa Gmail ${threadId}: ${response.status}`,
    );
  }
}

interface GmailLabelDetail {
  threadsTotal?: number;
  threadsUnread?: number;
}

interface GmailProfile {
  threadsTotal?: number;
}

export interface MailboxStats {
  inboxTotal: number;
  inboxUnread: number;
  inboxRead: number;
  mailboxTotal: number;
}

async function getLabelCounts(
  accessToken: string,
  labelId: string,
): Promise<GmailLabelDetail> {
  const response = await gmailFetch(`${GMAIL_API_BASE}/labels/${labelId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao obter a label Gmail ${labelId}: ${response.status}`,
    );
  }

  return (await response.json()) as GmailLabelDetail;
}

/**
 * Os totais saem dos contadores que o próprio Gmail já mantém, em vez de se contarem
 * mensagens à mão: são dois pedidos em paralelo, não a paginação da caixa toda, por
 * isso isto pode ser chamado sempre que a linha da conta abre.
 *
 * Contam-se **conversas** (threads) e não mensagens, porque é isso que o Gmail mostra
 * na sua própria interface — quem comparar os dois números espera vê-los iguais, e uma
 * caixa com muitas respostas encadeadas tem bastante mais mensagens do que conversas.
 *
 * O 'threadsTotal' do perfil já é exatamente a vista "Todos os e-mails" do Gmail: deixa
 * o spam e o lixo de fora sozinho. Medido numa conta real: perfil 526, igual ao que o
 * Gmail mostrava, com 475 conversas no lixo e 14 no spam à parte. Não subtrair nada aqui
 * — subtrair spam e lixo tirava 489 conversas que o perfil nunca tinha contado, e o
 * total caía de 526 para 37.
 */
export async function getMailboxStats(
  accessToken: string,
): Promise<MailboxStats> {
  const [inbox, profileResponse] = await Promise.all([
    getLabelCounts(accessToken, 'INBOX'),
    gmailFetch(`${GMAIL_API_BASE}/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  if (!profileResponse.ok) {
    throw new Error(`Falha ao obter o perfil Gmail: ${profileResponse.status}`);
  }

  const profile = (await profileResponse.json()) as GmailProfile;

  const inboxTotal = inbox.threadsTotal ?? 0;
  const inboxUnread = inbox.threadsUnread ?? 0;

  return {
    inboxTotal,
    inboxUnread,
    inboxRead: Math.max(0, inboxTotal - inboxUnread),
    mailboxTotal: profile.threadsTotal ?? 0,
  };
}
