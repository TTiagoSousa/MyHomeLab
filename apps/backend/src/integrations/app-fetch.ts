import { AppIntegrationError } from './app-integration.error';

// O fetch global (undici) só diz "fetch failed"; a causa verdadeira vem em error.cause.code.
const CAUSES: Record<string, string> = {
  DEPTH_ZERO_SELF_SIGNED_CERT:
    'o certificado é self-signed (usa o endereço http:// da LAN, um certificado válido — ex.: do Nginx Proxy Manager — ou junta a CA ao NODE_EXTRA_CA_CERTS do backend)',
  SELF_SIGNED_CERT_IN_CHAIN:
    'o certificado é de uma CA própria (self-signed): junta a CA ao NODE_EXTRA_CA_CERTS do backend ou usa o endereço http:// da LAN',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE:
    'não foi possível confirmar o certificado (falta a cadeia ou é de uma CA própria)',
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY:
    'o certificado é de uma CA que o backend não conhece (junta-a ao NODE_EXTRA_CA_CERTS)',
  CERT_HAS_EXPIRED: 'o certificado expirou',
  ERR_TLS_CERT_ALTNAME_INVALID:
    'o certificado não é deste nome (o endereço não bate com o certificado)',
  ECONNREFUSED:
    'a porta está fechada (a app está parada ou a porta está errada)',
  ENOTFOUND: 'o nome não foi encontrado (DNS)',
  EAI_AGAIN: 'o DNS não respondeu',
  EHOSTUNREACH: 'o anfitrião não está acessível na rede',
  ENETUNREACH: 'a rede não está acessível',
  ECONNRESET: 'a ligação foi cortada a meio',
  ETIMEDOUT: 'a ligação não respondeu a tempo',
  UND_ERR_CONNECT_TIMEOUT: 'a ligação não respondeu a tempo',
  EPROTO: 'falhou a negociação TLS (é mesmo https nesta porta?)',
};

/** Porque é que um fetch falhou, em português simples. */
export function describeFetchError(error: unknown): string {
  // O AbortSignal.timeout rejeita com um DOMException, que nem sempre é instanceof Error.
  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'TimeoutError' || name === 'AbortError') {
    return 'não respondeu a tempo';
  }
  if (!(error instanceof Error)) return String(error);
  const cause = (error as { cause?: { code?: unknown; message?: unknown } })
    .cause;
  const code = typeof cause?.code === 'string' ? cause.code : undefined;
  if (code && CAUSES[code]) return CAUSES[code];
  if (code) return `${error.message} (${code})`;
  return error.message;
}

/** Uma resposta 2xx que é uma página web e não dados: um login (SSO) ou um proxy à frente. */
export function looksLikeHtml(text: string): boolean {
  return /^\s*<(!doctype|html|head|body|\?xml)/i.test(text);
}

export function htmlResponseError(appName: string, what: string) {
  return new AppIntegrationError(
    'APP_UNREACHABLE',
    `O ${appName} respondeu uma página HTML em vez de dados (${what}): há um login (SSO) ou um proxy à frente, ou o endereço está errado.`,
  );
}

/** O corpo de uma resposta 2xx em JSON; uma página HTML ou texto que não é JSON dá um erro claro. */
export function parseAppJson<T>(
  text: string,
  appName: string,
  what: string,
): T {
  if (!text.trim()) return {} as T;
  if (looksLikeHtml(text)) throw htmlResponseError(appName, what);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AppIntegrationError(
      'APP_UNREACHABLE',
      `A resposta do ${appName} não é JSON (${what}): este endereço é mesmo um ${appName}?`,
    );
  }
}

/** Uma versão a sério ("4.7.6", "v1.22", "2024.10.1"): nunca se guarda HTML nem texto solto como versão. */
export function isVersionString(
  value: string | null | undefined,
): value is string {
  return typeof value === 'string' && /^v?\d+\.\d+/i.test(value.trim());
}
