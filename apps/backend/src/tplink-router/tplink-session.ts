import { Agent } from 'https';
import axios, { AxiosResponse } from 'axios';
import {
  aesDecrypt,
  aesEncrypt,
  chunks,
  hmacSha256Hex,
  md5Hex,
  randomDigits,
  randomHexKey,
  rsaKey,
  rsaOaep,
  rsaPkcs1,
  sha256Hex,
} from './tplink-crypto';

/*
 * O login e os pedidos à página de gestão de um router TP-Link (Archer), portados da
 * tplinkrouterc6u (GPL-3.0). Há cinco maneiras, conforme o aparelho e o firmware:
 * - classic: RSA + AES com assinatura MD5 (TplinkRouter; Archer C6U, AX, muitos BE);
 * - v1_11: só RSA, sem cifra nos pedidos (TplinkRouterV1_11; firmware 1.11+, chave de 2048 bits);
 * - sg: AES + OAEP no login e HMAC-SHA256 nos pedidos (TplinkRouterSG; Archer BE3600, BE230, BE600);
 * - re_classic: o classic dos extensores (TplinkRE235BERouter; RE235BE e afins), com o login
 *   vindo de webpages/login.html e os pedidos em formulário;
 * - re_plain: os extensores sem cifra (TplinkRE813XERouter; RE813XE, RE700X, RE505X), a chave RSA
 *   em login?form=login&operation=read e os pedidos às claras, em formulário.
 * Os pedidos do classic e do v1_11 vão em JSON (como o BE805); os outros em formulário.
 */

export type TplinkScheme =
  'classic' | 'v1_11' | 'sg' | 're_classic' | 're_plain';

export const TPLINK_SCHEMES: TplinkScheme[] = [
  'sg',
  'v1_11',
  'classic',
  're_classic',
  're_plain',
];

/** As maneiras com os pedidos cifrados em AES. */
const ENCRYPTED: TplinkScheme[] = ['classic', 'sg', 're_classic'];
/** As maneiras com os pedidos em JSON. */
const JSON_BODY: TplinkScheme[] = ['classic', 'v1_11'];

/** A sessão caiu ou o router não responde: é para voltar a ligar, não um erro dele. */
export class TplinkDisconnectedError extends Error {}

/** O router recusou o login (palavra-passe errada, bloqueado por tentativas a mais). */
export class TplinkLoginError extends Error {
  constructor(
    message: string,
    /** Bloqueado por tentativas a mais: passa sozinho, não é a palavra-passe. */
    readonly locked = false,
  ) {
    super(message);
  }
}

/** Esta maneira de entrar não é a do router (tenta-se a seguinte). */
class WrongSchemeError extends Error {}

/** O router respondeu, mas com um erro ao pedido (dado inválido, função que não tem). */
export class TplinkRequestError extends Error {}

const httpsAgent = new Agent({ rejectUnauthorized: false });

const TIMEOUT_MS = 15_000;

export const normalizeTplinkUrl = (url: string) => {
  const trimmed = url
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/webpages.*$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
};

interface Credentials {
  host: string;
  username: string;
  password: string;
}

interface SessionState extends Credentials {
  scheme: TplinkScheme;
  stok: string;
  sysauth: string;
  seq: number;
  nn: string;
  ee: string;
  hash: string;
  key: string;
  iv: string;
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Um pedido HTTP ao router; falhas de rede passam a "desligado". */
async function post(
  url: string,
  body: string,
  headers: Record<string, string>,
  params?: Record<string, string>,
): Promise<AxiosResponse<unknown>> {
  try {
    return await axios.post(url, body, {
      headers,
      params,
      httpsAgent,
      timeout: TIMEOUT_MS,
      responseType: 'text',
      transformResponse: (data: unknown) => data,
      validateStatus: () => true,
      maxRedirects: 0,
    });
  } catch (error) {
    throw new TplinkDisconnectedError(
      `o router não respondeu (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

const parseJson = (text: unknown): unknown => {
  if (typeof text !== 'string') return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

/** Os extensores só aceitam o login vindo de webpages/login.html (sem Referer dão 400). */
type LoginPage = 'index' | 'login';

const loginHeaders = (host: string, page: LoginPage = 'index') => ({
  Referer: `${host}/webpages/${page}.html`,
  'Content-Type': 'application/x-www-form-urlencoded',
});

const requestHeaders = (host: string, json: boolean) => ({
  Referer: `${host}/webpages/index.html`,
  Origin: host,
  'Content-Type': json
    ? 'application/json'
    : 'application/x-www-form-urlencoded',
});

const sysauthOf = (response: AxiosResponse<unknown>) => {
  const raw = response.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw.join(';') : String(raw ?? '');
  return /sysauth=([^;]+)/.exec(cookies)?.[1] ?? '';
};

const form = (fields: Record<string, string>) =>
  new URLSearchParams(fields).toString();

/** As chaves RSA da palavra-passe (login?form=keys). */
async function passwordKeys(host: string, page: LoginPage = 'index') {
  const response = await post(
    `${host}/cgi-bin/luci/;stok=/login?form=keys`,
    '',
    loginHeaders(host, page),
    { operation: 'read' },
  );
  const data = parseJson(response.data);
  const password =
    isObject(data) && isObject(data.data) ? data.data.password : null;
  if (!Array.isArray(password) || password.length < 2) {
    throw new WrongSchemeError('sem as chaves de login?form=keys');
  }
  return { nn: String(password[0]), ee: String(password[1]) };
}

/** A sequência e a chave RSA das assinaturas (login?form=auth). */
async function authKeys(host: string, page: LoginPage = 'index') {
  const response = await post(
    `${host}/cgi-bin/luci/;stok=/login?form=auth`,
    '',
    loginHeaders(host, page),
    { operation: 'read' },
  );
  const data = parseJson(response.data);
  const block = isObject(data) && isObject(data.data) ? data.data : null;
  const key = block?.key;
  if (!block || !Array.isArray(key) || key.length < 2) {
    throw new WrongSchemeError('sem login?form=auth');
  }
  return { seq: Number(block.seq), nn: String(key[0]), ee: String(key[1]) };
}

/** Um valor simples do router em texto (um objeto vira JSON). */
export const scalarText = (value: unknown): string =>
  typeof value === 'string'
    ? value
    : typeof value === 'number' ||
        typeof value === 'boolean' ||
        typeof value === 'bigint'
      ? String(value)
      : value === undefined || value === null
        ? ''
        : JSON.stringify(value);

/** O porquê de um login recusado, nas palavras do router. */
function loginFailure(decrypted: Json): TplinkLoginError {
  const data = isObject(decrypted.data) ? decrypted.data : {};
  const code =
    scalarText(decrypted.errorcode ?? data.errorcode) || 'desconhecido';
  const attempts =
    data.failureCount !== undefined
      ? ` (${scalarText(data.failureCount)} tentativas falhadas de ${scalarText(data.attemptsAllowed) || '?'})`
      : '';
  if (/exceeded|max attempts|locked/i.test(code)) {
    return new TplinkLoginError(
      `o router bloqueou o login por tentativas a mais${attempts}; passa sozinho daqui a uns minutos`,
      true,
    );
  }
  if (/conflict|another|other user/i.test(code)) {
    return new TplinkLoginError(
      'há outra sessão aberta na página do router e ele não deixou entrar',
      true,
    );
  }
  return new TplinkLoginError(
    `o router recusou o utilizador ou a palavra-passe (${code})${attempts}. Usa a palavra-passe local do router (a do TP-Link ID não serve)`,
  );
}

function stokOf(decrypted: Json): string {
  const data = isObject(decrypted.data) ? decrypted.data : null;
  const stok = data?.stok;
  if (typeof stok !== 'string' || !stok) throw new WrongSchemeError('sem stok');
  return stok;
}

/**
 * Login clássico: palavra-passe em RSA e o pedido cifrado em AES, assinado com MD5. O dos
 * extensores (re_classic) é igual, mas vindo de webpages/login.html.
 */
async function loginClassic(
  credentials: Credentials,
  scheme: 'classic' | 're_classic' = 'classic',
): Promise<SessionState> {
  const { host, username, password } = credentials;
  const page: LoginPage = scheme === 're_classic' ? 'login' : 'index';
  const attempt = async () => {
    const pwd = await passwordKeys(host, page);
    const auth = await authKeys(host, page);
    const session: SessionState = {
      ...credentials,
      scheme,
      stok: '',
      sysauth: '',
      seq: auth.seq,
      nn: auth.nn,
      ee: auth.ee,
      hash: md5Hex(username + password),
      key: randomHexKey(),
      iv: randomHexKey(),
    };
    const data = aesEncrypt(
      `operation=login&password=${rsaPkcs1(password, pwd.nn, pwd.ee)}&confirm=true`,
      session.key,
      session.iv,
    );
    const response = await post(
      `${host}/cgi-bin/luci/;stok=/login?form=login`,
      form({ sign: classicSign(session, data.length, true), data }),
      loginHeaders(host, page),
    );
    return { session, response };
  };
  let { session, response } = await attempt();
  let body = parseJson(response.data);
  // Como a biblioteca: uma resposta estranha ou 403 ao login repete-se uma vez com chaves novas.
  if (!isObject(body) || response.status === 403) {
    ({ session, response } = await attempt());
    body = parseJson(response.data);
  }
  if (!isObject(body) || typeof body.data !== 'string') {
    throw new WrongSchemeError('resposta ao login sem dados cifrados');
  }
  let decrypted: unknown;
  try {
    decrypted = parseJson(aesDecrypt(body.data, session.key, session.iv));
  } catch {
    throw new WrongSchemeError('resposta ao login que não se decifra');
  }
  if (!isObject(decrypted))
    throw new WrongSchemeError('resposta ao login inválida');
  if (!decrypted.success) throw loginFailure(decrypted);
  return { ...session, stok: stokOf(decrypted), sysauth: sysauthOf(response) };
}

function classicSign(
  session: SessionState,
  dataLength: number,
  isLogin: boolean,
) {
  const text = `${isLogin ? `k=${session.key}&i=${session.iv}&` : ''}h=${session.hash}&s=${session.seq + dataLength}`;
  return chunks(text, 53)
    .map((part) => rsaPkcs1(part, session.nn, session.ee))
    .join('');
}

/** Login do firmware 1.11+: só a palavra-passe em RSA, os pedidos vão às claras. */
async function loginV111(credentials: Credentials): Promise<SessionState> {
  const { host, password } = credentials;
  const pwd = await passwordKeys(host);
  if (pwd.nn.length < 512) throw new WrongSchemeError('chave RSA pequena');
  const response = await post(
    `${host}/cgi-bin/luci/;stok=/login?form=login`,
    `operation=login&password=${rsaPkcs1(password, pwd.nn, pwd.ee)}`,
    loginHeaders(host),
  );
  const body = parseJson(response.data);
  if (!isObject(body) || typeof body.data === 'string') {
    throw new WrongSchemeError('resposta ao login cifrada ou inválida');
  }
  if (!body.success) throw loginFailure(body);
  return {
    ...credentials,
    scheme: 'v1_11',
    stok: stokOf(body),
    sysauth: sysauthOf(response),
    seq: 0,
    nn: '',
    ee: '',
    hash: '',
    key: '',
    iv: '',
  };
}

/** Login "SG": SHA-256, a assinatura em RSA-OAEP e o pedido em AES. */
async function loginSg(credentials: Credentials): Promise<SessionState> {
  const { host, username, password } = credentials;
  const pwd = await passwordKeys(host);
  const auth = await authKeys(host);
  const session: SessionState = {
    ...credentials,
    scheme: 'sg',
    stok: '',
    sysauth: '',
    seq: auth.seq,
    nn: auth.nn,
    ee: auth.ee,
    hash: sha256Hex(username + password),
    key: randomDigits(),
    iv: randomDigits(),
  };
  const data = aesEncrypt(
    `operation=login&password=${rsaPkcs1(password, pwd.nn, pwd.ee)}&confirm=true`,
    session.key,
    session.iv,
  );
  // O OAEP gasta 42 bytes por bloco; nas chaves pequenas os pedaços de 53 não cabem.
  const step = Math.min(53, rsaKey(session.nn, session.ee).size - 42);
  const sign = chunks(
    `k=${session.key}&i=${session.iv}&h=${session.hash}&s=${session.seq + data.length}`,
    step,
  )
    .map((part) => rsaOaep(part, session.nn, session.ee))
    .join('');
  const response = await post(
    `${host}/cgi-bin/luci/;stok=/login?form=login`,
    `sign=${sign}&data=${encodeURIComponent(data)}`,
    loginHeaders(host),
  );
  const body = parseJson(response.data);
  if (!isObject(body) || typeof body.data !== 'string') {
    throw new WrongSchemeError('resposta ao login sem dados cifrados');
  }
  let decrypted: unknown;
  try {
    decrypted = parseJson(aesDecrypt(body.data, session.key, session.iv));
  } catch {
    throw new WrongSchemeError('resposta ao login que não se decifra');
  }
  if (!isObject(decrypted))
    throw new WrongSchemeError('resposta ao login inválida');
  if (!decrypted.success) throw loginFailure(decrypted);
  return { ...session, stok: stokOf(decrypted), sysauth: sysauthOf(response) };
}

/** Login dos extensores sem cifra: a chave RSA vem do próprio login, os pedidos às claras. */
async function loginRePlain(credentials: Credentials): Promise<SessionState> {
  const { host, password } = credentials;
  const keys = await post(
    `${host}/cgi-bin/luci/;stok=/login?form=login&operation=read`,
    '',
    loginHeaders(host, 'login'),
  );
  const keyData = parseJson(keys.data);
  const pair =
    isObject(keyData) && isObject(keyData.data) ? keyData.data.password : null;
  if (!Array.isArray(pair) || pair.length < 2) {
    throw new WrongSchemeError('sem a chave em login?form=login');
  }
  const response = await post(
    `${host}/cgi-bin/luci/;stok=/login?form=login`,
    `operation=login&password=${rsaPkcs1(password, String(pair[0]), String(pair[1]))}`,
    loginHeaders(host, 'login'),
  );
  const body = parseJson(response.data);
  if (!isObject(body) || typeof body.data === 'string') {
    throw new WrongSchemeError('resposta ao login cifrada ou inválida');
  }
  if (!body.success) throw loginFailure(body);
  return {
    ...credentials,
    scheme: 're_plain',
    stok: stokOf(body),
    sysauth: sysauthOf(response),
    seq: 0,
    nn: '',
    ee: '',
    hash: '',
    key: '',
    iv: '',
  };
}

const LOGIN: Record<
  TplinkScheme,
  (credentials: Credentials) => Promise<SessionState>
> = {
  classic: (credentials) => loginClassic(credentials, 'classic'),
  v1_11: loginV111,
  sg: loginSg,
  re_classic: (credentials) => loginClassic(credentials, 're_classic'),
  re_plain: loginRePlain,
};

/**
 * Entra no router. Com `scheme` usa essa maneira; sem ela experimenta as três pela ordem da
 * biblioteca e para logo que o router responde a sério (uma palavra-passe errada não passa à
 * seguinte, para não somar tentativas falhadas).
 */
export async function tplinkLogin(
  credentials: Credentials,
  scheme?: TplinkScheme | null,
): Promise<TplinkSession> {
  const order = scheme ? [scheme] : TPLINK_SCHEMES;
  const tried: string[] = [];
  for (const candidate of order) {
    try {
      return new TplinkSession(await LOGIN[candidate](credentials));
    } catch (error) {
      if (!(error instanceof WrongSchemeError)) throw error;
      tried.push(`${candidate}: ${error.message}`);
    }
  }
  throw new TplinkRequestError(
    `não consegui entrar com nenhuma das maneiras que conheço (${tried.join('; ')}). Confirma que o endereço é o da página de gestão do router ou do extensor; se for, este firmware pode não ser suportado`,
  );
}

/** Uma sessão aberta no router: os pedidos assinados com o stok e o cookie dela. */
export class TplinkSession {
  constructor(private state: SessionState) {}

  get scheme(): TplinkScheme {
    return this.state.scheme;
  }

  /**
   * Um pedido a um formulário da página do router (ex.: "admin/status?form=all&operation=read",
   * "operation=read"). Devolve o bloco `data` da resposta.
   */
  async request(
    path: string,
    data: string,
    ignoreResponse = false,
  ): Promise<unknown> {
    const { scheme } = this.state;
    const json = JSON_BODY.includes(scheme);
    const prepared =
      scheme === 'sg'
        ? mergeParams(path, data)
        : json
          ? jsonRequest(path, data)
          : { path, data };
    const url = `${this.state.host}/cgi-bin/luci/;stok=${this.state.stok}/${prepared.path}`;
    const headers = {
      ...requestHeaders(this.state.host, json),
      ...(scheme === 're_plain'
        ? {
            Accept: 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest',
          }
        : {}),
      Cookie: `sysauth=${this.state.sysauth}`,
    };
    const response = await post(url, this.body(prepared.data), headers);
    if (ignoreResponse) return null;
    if (response.status === 401 || response.status === 403) {
      throw new TplinkDisconnectedError('a sessão no router acabou');
    }
    const body = parseJson(response.data);
    let decoded: unknown = body;
    if (ENCRYPTED.includes(scheme)) {
      if (!isObject(body) || typeof body.data !== 'string') {
        throw this.unexpected(path, body);
      }
      try {
        decoded = parseJson(
          aesDecrypt(body.data, this.state.key, this.state.iv),
        );
      } catch {
        throw new TplinkDisconnectedError('a sessão no router acabou');
      }
    }
    if (!isObject(decoded)) throw this.unexpected(path, body);
    if (scheme === 'sg' && decoded.success) return decoded.data ?? decoded;
    if (scheme === 're_plain' && decoded.success) return decoded.data;
    if (decoded.success && 'data' in decoded) return decoded.data;
    throw this.unexpected(path, decoded);
  }

  /** O corpo de um pedido: cifrado e assinado (classic, re_classic, sg) ou às claras. */
  private body(data: string): string {
    const state = this.state;
    if (!ENCRYPTED.includes(state.scheme)) return data;
    const encrypted = aesEncrypt(data, state.key, state.iv);
    if (state.scheme === 'classic' || state.scheme === 're_classic') {
      return form({
        sign: classicSign(state, encrypted.length, false),
        data: encrypted,
      });
    }
    // sg: a hash passa a ser a do pedido cifrado, e a assinatura é HMAC em pedaços de 53.
    state.hash = sha256Hex(encrypted);
    const sign = chunks(`h=${state.hash}&s=${state.seq + encrypted.length}`, 53)
      .map((part) => hmacSha256Hex(`k=${state.key}&i=${state.iv}`, part))
      .join('');
    return `sign=${sign}&data=${encodeURIComponent(encrypted)}`;
  }

  /** Um erro do router a um pedido; um erro de sessão passa a "desligado". */
  private unexpected(path: string, body: unknown): Error {
    const code = isObject(body) ? scalarText(body.errorcode) : '';
    if (/timeout|session|unauthori|not ?login|login/i.test(code)) {
      return new TplinkDisconnectedError('a sessão no router acabou');
    }
    return new TplinkRequestError(
      `o router respondeu com erro a ${path.split('?')[0]}${code ? ` (${code})` : ''}`,
    );
  }

  async logout(): Promise<void> {
    await this.request(
      'admin/system?form=logout',
      'operation=write',
      true,
    ).catch(() => undefined);
  }
}

/**
 * Os routers "JSON" (classic e v1_11) querem o pedido em JSON e os parâmetros também no URL
 * (o que ainda lá não está acrescenta-se), como o TplinkRouterJson.
 */
function jsonRequest(path: string, data: string) {
  const params = Object.fromEntries(new URLSearchParams(data));
  let full = path;
  for (const [key, value] of Object.entries(params)) {
    if (!full.includes(`${key}=`)) {
      full += `${full.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}`;
    }
  }
  return { path: full, data: JSON.stringify(params) };
}

/**
 * Nos routers "sg" um parâmetro não pode vir no URL e no corpo: o igual sai do corpo; um com
 * valor diferente fica no corpo e sai do URL (como o _merge_path_and_body_params).
 */
function mergeParams(path: string, data: string) {
  const [base, query] = path.split('?', 2);
  if (query === undefined) return { path, data };
  const pathParams = [...new URLSearchParams(query)];
  const pathMap = new Map(pathParams);
  const conflicts = new Set<string>();
  const body: [string, string][] = [];
  for (const [key, value] of new URLSearchParams(data)) {
    if (!pathMap.has(key)) body.push([key, value]);
    else if (pathMap.get(key) !== value) {
      body.push([key, value]);
      conflicts.add(key);
    }
  }
  const kept = pathParams.filter(([key]) => !conflicts.has(key));
  return {
    path: kept.length
      ? `${base}?${new URLSearchParams(kept).toString()}`
      : base,
    data: new URLSearchParams(body).toString(),
  };
}
