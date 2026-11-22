const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Um pedido ao Google pendurado segurava o cron das regras (e a página) para sempre.
export const GOOGLE_TIMEOUT_MS = 30_000;

/**
 * O Google retirou o acesso (invalid_grant): o refresh token foi revogado ou expirou — numa
 * app OAuth em modo "Testing" acontece de 7 em 7 dias. Só se resolve voltando a ligar.
 */
export class GoogleAccessRevokedError extends Error {
  constructor() {
    super(
      'O Google retirou o acesso a esta conta (revogado ou expirado). Volta a ligá-la em Apps.',
    );
    this.name = 'GoogleAccessRevokedError';
  }
}

/** O que se liga com uma conta Google: o Gmail, o Google Tasks ou o Drive (cada um a sua conta). */
export type GoogleConnectionKind = 'gmail' | 'tasks' | 'drive';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  // Filtros do Gmail e resposta automática de férias.
  'https://www.googleapis.com/auth/gmail.settings.basic',
  // Acesso total: o único que deixa apagar emails de vez (sem passar pelo lixo).
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/userinfo.email',
];

// Só as tarefas: ligar o Google Tasks não dá acesso ao email.
const TASKS_SCOPES = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/userinfo.email',
];

// O Drive todo (procurar, ler, criar, copiar) e as Folhas do Google (mexer nas células).
// Ligar o Drive não dá acesso ao email.
const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
];

const SCOPES: Record<GoogleConnectionKind, string[]> = {
  gmail: GMAIL_SCOPES,
  tasks: TASKS_SCOPES,
  drive: DRIVE_SCOPES,
};

/** O tipo de ligação que veio no pedido (omissão: o Gmail). */
export const googleKind = (value: unknown): GoogleConnectionKind =>
  value === 'tasks' || value === 'drive' ? value : 'gmail';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não está definida`);
  return value;
}

export function buildGoogleConsentUrl(
  state: string,
  kind: GoogleConnectionKind,
): string {
  const params = new URLSearchParams({
    client_id: getEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: getEnv('GOOGLE_OAUTH_REDIRECT_URI'),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES[kind].join(' '),
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeGoogleCode(
  code: string,
): Promise<GoogleTokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getEnv('GOOGLE_CLIENT_ID'),
      client_secret: getEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: getEnv('GOOGLE_OAUTH_REDIRECT_URI'),
      grant_type: 'authorization_code',
      code,
    }),
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Falha ao trocar código Google por tokens: ${response.status}`,
    );
  }

  return response.json() as Promise<GoogleTokenResponse>;
}

interface GoogleRefreshResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<GoogleRefreshResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getEnv('GOOGLE_CLIENT_ID'),
      client_secret: getEnv('GOOGLE_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (body.error === 'invalid_grant') throw new GoogleAccessRevokedError();
    throw new Error(
      `Falha ao renovar o token Google: ${response.status}${body.error ? ` (${body.error})` : ''}`,
    );
  }

  return response.json() as Promise<GoogleRefreshResponse>;
}

export async function fetchGoogleEmailAddress(
  accessToken: string,
): Promise<string> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(GOOGLE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter perfil Google: ${response.status}`);
  }

  const data = (await response.json()) as { email: string };
  return data.email;
}
