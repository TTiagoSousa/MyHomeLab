import {
  normalizeTplinkUrl,
  scalarText,
  TplinkDisconnectedError,
  tplinkLogin,
  TplinkLoginError,
  TplinkRequestError,
  TplinkScheme,
  TPLINK_SCHEMES,
  TplinkSession,
} from './tplink-session';

export {
  normalizeTplinkUrl,
  TplinkDisconnectedError,
  TplinkLoginError,
  TplinkRequestError,
};
export type { TplinkScheme };

/*
 * Um router TP-Link (Archer, ex.: BE400) pela página de gestão, como a tplinkrouterc6u
 * (GPL-3.0). A página só aceita uma sessão de cada vez: o MyHomeLab entra quando precisa, faz o
 * que tem a fazer e sai ao fim de IDLE_LOGOUT_MS sem pedidos, para não te tirar da página.
 * Se a sessão cair (entraste na página, o router reiniciou, a rede falhou) a conta fica
 * "desligada" — não é um erro — e volta a ligar sozinha de RETRY_MS em RETRY_MS.
 */

/** De quanto em quanto tempo se volta a tentar ligar quando a sessão caiu. */
export const RETRY_MS = 5 * 60_000;

/** Sem pedidos durante este tempo, o MyHomeLab sai da página do router. */
const IDLE_LOGOUT_MS = 90_000;

/** Quanto tempo vale o estado lido (a página de gestão é lenta e só tem uma sessão). */
const STATUS_CACHE_MS = 20_000;

export interface TplinkAccount {
  id: string;
  baseUrl: string | null;
  username: string | null;
  appPassword: string | null;
  /** A maneira de entrar que funcionou ao ligar (fica em scopes, ex.: "tplink:sg"). */
  scopes?: string[];
}

export type TplinkLinkState = 'connected' | 'disconnected' | 'failed';

export interface TplinkConnection {
  state: TplinkLinkState;
  /** Desde quando está assim. */
  since: string;
  /** O motivo, quando não está ligado. */
  message: string | null;
  /** Quando volta a tentar ligar sozinho (só desligado). */
  nextRetryAt: string | null;
  scheme: TplinkScheme | null;
  /** Router ou extensor (visto ao ligar: um extensor não tem o estado geral de um router). */
  kind: TplinkKind;
}

export type TplinkKind = 'router' | 'extender';

interface Link extends TplinkConnection {
  credentials: { host: string; username: string; password: string };
  schemeHint: TplinkScheme | null;
  session: TplinkSession | null;
  idleTimer: NodeJS.Timeout | null;
  queue: Promise<unknown>;
  statusCache: { at: number; value: TplinkStatus } | null;
}

const links = new Map<string, Link>();

const SCHEME_PREFIX = 'tplink:';

export const schemeScope = (scheme: TplinkScheme) =>
  `${SCHEME_PREFIX}${scheme}`;

const KIND_SCOPE = 'tplink-kind:extender';

/** O que se guarda em scopes: a maneira de entrar e, num extensor, o tipo. */
export const tplinkScopes = (scheme: TplinkScheme, kind: TplinkKind) =>
  kind === 'extender'
    ? [schemeScope(scheme), KIND_SCOPE]
    : [schemeScope(scheme)];

const schemeOf = (account: TplinkAccount): TplinkScheme | null => {
  const scope = account.scopes?.find((item) => item.startsWith(SCHEME_PREFIX));
  const value = scope?.slice(SCHEME_PREFIX.length);
  return (TPLINK_SCHEMES as string[]).includes(value ?? '')
    ? (value as TplinkScheme)
    : null;
};

const kindOf = (account: TplinkAccount): TplinkKind =>
  account.scopes?.includes(KIND_SCOPE) ? 'extender' : 'router';

const nowIso = () => new Date().toISOString();

function linkOf(account: TplinkAccount): Link {
  const credentials = {
    host: normalizeTplinkUrl(account.baseUrl ?? ''),
    username: account.username || 'admin',
    password: account.appPassword ?? '',
  };
  const existing = links.get(account.id);
  if (
    existing &&
    existing.credentials.host === credentials.host &&
    existing.credentials.username === credentials.username &&
    existing.credentials.password === credentials.password
  ) {
    return existing;
  }
  if (existing) void dropSession(existing);
  const link: Link = {
    state: 'connected',
    since: nowIso(),
    message: null,
    nextRetryAt: null,
    scheme: schemeOf(account),
    kind: kindOf(account),
    credentials,
    schemeHint: schemeOf(account),
    session: null,
    idleTimer: null,
    queue: Promise.resolve(),
    statusCache: null,
  };
  links.set(account.id, link);
  return link;
}

async function dropSession(link: Link) {
  if (link.idleTimer) clearTimeout(link.idleTimer);
  link.idleTimer = null;
  const session = link.session;
  link.session = null;
  if (session) await session.logout();
}

function setState(link: Link, state: TplinkLinkState, message: string | null) {
  if (link.state !== state) link.since = nowIso();
  link.state = state;
  link.message = message;
  link.nextRetryAt =
    state === 'disconnected'
      ? new Date(Date.now() + RETRY_MS).toISOString()
      : null;
}

function touch(link: Link) {
  if (link.idleTimer) clearTimeout(link.idleTimer);
  link.idleTimer = setTimeout(() => {
    void dropSession(link);
  }, IDLE_LOGOUT_MS);
  link.idleTimer.unref?.();
}

async function sessionFor(link: Link): Promise<TplinkSession> {
  if (link.session) return link.session;
  const session = await tplinkLogin(link.credentials, link.schemeHint);
  link.session = session;
  link.schemeHint = session.scheme;
  link.scheme = session.scheme;
  return session;
}

const lisbonTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-PT', {
    timeZone: 'Europe/Lisbon',
    hour: '2-digit',
    minute: '2-digit',
  });

/** O texto para os agentes e para a página quando a conta não está ligada. */
export function describeConnection(connection: TplinkConnection): string {
  if (connection.state === 'disconnected') {
    return `O router está desligado do MyHomeLab: ${connection.message ?? 'a sessão caiu'}. Não é um erro — volto a ligar sozinho de 5 em 5 minutos${connection.nextRetryAt ? ` (próxima tentativa às ${lisbonTime(connection.nextRetryAt)})` : ''}.`;
  }
  if (connection.state === 'failed') {
    return `O router não deixou entrar: ${connection.message ?? 'login recusado'}. Corrige a palavra-passe em Apps ligadas → TP-Link Archer.`;
  }
  return 'Ligado ao router.';
}

/** Um erro que significa "desligado" (e não um erro do pedido). */
export class TplinkOfflineError extends Error {
  constructor(readonly connection: TplinkConnection) {
    super(describeConnection(connection));
  }
}

const connectionOf = (link: Link): TplinkConnection => ({
  state: link.state,
  since: link.since,
  message: link.message,
  nextRetryAt: link.nextRetryAt,
  scheme: link.scheme,
  kind: link.kind,
});

/** O estado da ligação a este router, sem lhe tocar. */
export function tplinkConnection(account: TplinkAccount): TplinkConnection {
  return connectionOf(linkOf(account));
}

/**
 * Corre `work` com uma sessão no router, um pedido de cada vez por conta. Desligado e antes da
 * próxima tentativa, não toca no router (salvo `force`). Se a sessão cair a meio, entra outra vez
 * e repete uma vez; se ainda assim não der, fica desligado.
 */
export function withTplinkRouter<T>(
  account: TplinkAccount,
  work: (router: TplinkRouterApi) => Promise<T>,
  options: { force?: boolean } = {},
): Promise<T> {
  const link = linkOf(account);
  const run = async (): Promise<T> => {
    const waiting =
      link.state !== 'connected' &&
      !options.force &&
      link.nextRetryAt !== null &&
      Date.parse(link.nextRetryAt) > Date.now();
    if (waiting || (link.state === 'failed' && !options.force)) {
      throw new TplinkOfflineError(connectionOf(link));
    }
    // O relógio da saída por inatividade pára enquanto há trabalho: só recomeça no fim
    // (touch), senão uma leitura que começa aos 85 s levava logout a meio.
    if (link.idleTimer) clearTimeout(link.idleTimer);
    link.idleTimer = null;
    for (let attempt = 0; ; attempt += 1) {
      let session: TplinkSession | null = null;
      try {
        session = await sessionFor(link);
        const result = await work(
          new TplinkRouterApi(session, link, link.kind),
        );
        setState(link, 'connected', null);
        touch(link);
        return result;
      } catch (error) {
        if (error instanceof TplinkLoginError) {
          link.session = null;
          if (error.locked) setState(link, 'disconnected', error.message);
          else setState(link, 'failed', error.message);
          throw new TplinkOfflineError(connectionOf(link));
        }
        if (error instanceof TplinkDisconnectedError) {
          link.session = null;
          if (attempt === 0) continue;
          setState(link, 'disconnected', error.message);
          throw new TplinkOfflineError(connectionOf(link));
        }
        // Falhou a entrar (ex.: o router a arrancar responde coisas estranhas): é a ligação,
        // não o pedido — fica desligado e tenta outra vez daqui a 5 min, não a cada minuto.
        if (!session) {
          link.session = null;
          setState(
            link,
            'disconnected',
            error instanceof Error ? error.message : String(error),
          );
          throw new TplinkOfflineError(connectionOf(link));
        }
        touch(link);
        throw error;
      }
    }
  };
  const result = link.queue.then(run, run);
  link.queue = result.catch(() => undefined);
  return result;
}

/**
 * Os routers desligados cuja próxima tentativa já passou: volta a entrar (o agendador, de minuto
 * a minuto). Os que já não estão em `activeIds` (conta apagada ou desativada) esquecem-se.
 */
export async function reconnectDueTplinkRouters(
  activeIds: Set<string>,
): Promise<void> {
  for (const [id, link] of links) {
    if (!activeIds.has(id)) {
      forgetTplinkRouter(id);
      continue;
    }
    if (link.state !== 'disconnected' || !link.nextRetryAt) continue;
    if (Date.parse(link.nextRetryAt) > Date.now()) continue;
    await withTplinkRouter(
      {
        id,
        baseUrl: link.credentials.host,
        username: link.credentials.username,
        appPassword: link.credentials.password,
        scopes: link.schemeHint ? tplinkScopes(link.schemeHint, link.kind) : [],
      },
      (router) => router.firmware(),
      { force: true },
    ).catch(() => undefined);
  }
}

/** Esquece um router (a conta foi apagada ou ligada de novo). */
export function forgetTplinkRouter(accountId: string) {
  const link = links.get(accountId);
  if (link) void dropSession(link);
  links.delete(accountId);
}

/** Liga pela primeira vez: descobre a maneira de entrar e lê o firmware, sem guardar nada. */
export async function probeTplinkRouter(credentials: {
  baseUrl: string;
  username: string;
  password: string;
}) {
  const session = await tplinkLogin({
    host: normalizeTplinkUrl(credentials.baseUrl),
    username: credentials.username || 'admin',
    password: credentials.password,
  });
  try {
    const kind = await detectKind(session);
    const api = new TplinkRouterApi(session, null, kind);
    return { scheme: session.scheme, kind, firmware: await api.firmware() };
  } finally {
    await session.logout();
  }
}

/**
 * Router ou extensor, como o TplinkRE813XERouter.supports: um extensor responde ao
 * admin/status?form=ap_status com o Wi-Fi e não tem o admin/status?form=all de um router.
 */
async function detectKind(session: TplinkSession): Promise<TplinkKind> {
  const ap = await session
    .request('admin/status?form=ap_status', 'operation=read')
    .catch(() => null);
  const markers = [
    'wireless_2g_enable',
    'wireless_5g_enable',
    'wireless_6g_enable',
    'wirelessGrid',
  ];
  if (!ap || typeof ap !== 'object' || !markers.some((key) => key in ap))
    return 'router';
  const all = await session
    .request('admin/status?form=all&operation=read', 'operation=read')
    .then(() => true)
    .catch(() => false);
  return all ? 'router' : 'extender';
}

// ── O que se lê e se faz ───────────────────────────────────────────────────

export type TplinkBand = '2g' | '5g' | '6g';
export type TplinkNetwork = 'host' | 'guest' | 'iot';

export const TPLINK_BANDS: TplinkBand[] = ['2g', '5g', '6g'];
export const TPLINK_NETWORKS: TplinkNetwork[] = ['host', 'guest', 'iot'];

/** O formulário de cada rede (wireless_2g, guest_5g, iot_6g…). */
const wifiForm = (network: TplinkNetwork, band: TplinkBand) =>
  `${network === 'host' ? 'wireless' : network}_${band}`;

export interface TplinkFirmware {
  model: string;
  hardwareVersion: string;
  firmwareVersion: string;
}

export interface TplinkDevice {
  mac: string;
  ip: string;
  hostname: string;
  /** wired, host_2g, host_5g, host_6g, host_mlo, guest_*, iot_*, unknown */
  connection: string;
  downSpeed: number | null;
  upSpeed: number | null;
  signal: number | null;
  onlineSeconds: number | null;
  trafficBytes: number | null;
  /** No mesh: o nó onde está ligado (o router principal ou o nome do extensor); null sem mesh. */
  apName?: string | null;
  /** Ligado a um extensor do mesh (e não ao router principal). */
  viaSatellite?: boolean;
}

export interface TplinkStatus {
  wanMac: string | null;
  lanMac: string | null;
  wanIp: string | null;
  lanIp: string | null;
  wanGateway: string | null;
  wanUptimeSeconds: number | null;
  wanConnType: string | null;
  wanIpv6Enabled: boolean | null;
  lanDhcpEnabled: boolean | null;
  cpuUsage: number | null;
  memUsage: number | null;
  wifi: Record<TplinkNetwork, Partial<Record<TplinkBand, boolean | null>>>;
  mlo: Partial<Record<TplinkBand, boolean | null>>;
  wiredTotal: number;
  wifiTotal: number;
  guestTotal: number;
  iotTotal: number;
  devices: TplinkDevice[];
}

export interface TplinkWifi {
  network: TplinkNetwork;
  band: TplinkBand;
  enabled: boolean | null;
  ssid: string | null;
  hidden: boolean | null;
  encryption: string | null;
  channel: number | null;
}

export interface TplinkReservation {
  mac: string;
  ip: string;
  name: string;
  enabled: boolean | null;
}

export interface TplinkLease {
  mac: string;
  ip: string;
  name: string;
  leaseTime: string;
}

export interface TplinkPortForward {
  name: string;
  ip: string;
  externalPort: string;
  internalPort: string;
  protocol: string;
  enabled: boolean | null;
}

export interface TplinkPort {
  port: number;
  name: string;
  linkUp: boolean | null;
  speedMbps: number | null;
  duplex: string | null;
}

export interface TplinkRepeaterBand {
  connection: string | null;
  connected: boolean;
  ssid: string | null;
  rssi: number | null;
  rxRateMbps: number | null;
  txRateMbps: number | null;
}

/** A ligação de um extensor ao router principal (admin/status?form=rootAP e repeater). */
export interface TplinkRepeater {
  /** Ligado por cabo ao router principal (mesh com fio): o IP dele, ou null. */
  wired: { connected: boolean; ip: string | null };
  band2g: TplinkRepeaterBand;
  band5g: TplinkRepeaterBand;
  internetStatus: string | null;
  meshEnabled: boolean | null;
  meshSync: string | null;
}

export interface TplinkMeshNode {
  name: string | null;
  model: string | null;
  role: string | null;
  status: string | null;
  mac: string | null;
  ip: string | null;
  clients: number | null;
}

const toBool = (value: unknown): boolean | null =>
  value === undefined || value === null
    ? null
    : ['yes', 'true', 'on', '1'].includes(scalarText(value).toLowerCase());

const toNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const text = (value: unknown) => scalarText(value);

/** CPU e memória em %: uns firmwares dão a fração (0.38), outros já a percentagem (38). */
const percent = (value: unknown): number | null => {
  const number = toNumber(value);
  if (number === null) return null;
  return Math.round((number < 1 ? number * 100 : number) * 10) / 10;
};

/** O MAC como o router o guarda: AA-BB-CC-DD-EE-FF. */
export function normalizeMac(value: string): string {
  const hex = value.replace(/[^0-9a-f]/gi, '').toUpperCase();
  if (hex.length !== 12) throw new TplinkRequestError(`MAC inválido: ${value}`);
  return hex.match(/.{2}/g)!.join('-');
}

const safeMac = (value: unknown) => {
  try {
    return normalizeMac(text(value));
  } catch {
    return text(value);
  }
};

const isIpv4 = (value: string) =>
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(
    value.trim(),
  );

/** O tipo de ligação de um dispositivo (como o _map_wire_type). */
function wireType(value: unknown, host = true): string {
  const raw = text(value);
  if (!raw) return 'unknown';
  if (raw === 'wired') return 'wired';
  const prefix = host ? 'host' : 'guest';
  if (raw.startsWith('2.4')) return `${prefix}_2g`;
  if (raw.startsWith('5')) return `${prefix}_5g`;
  if (raw.startsWith('6')) return `${prefix}_6g`;
  if (raw.startsWith('iot_2')) return 'iot_2g';
  if (raw.startsWith('iot_5')) return 'iot_5g';
  if (raw.startsWith('iot_6')) return 'iot_6g';
  if (raw === 'mlo') return 'host_mlo';
  return 'unknown';
}

/** Uma lista que uns firmwares mandam crua e outros dentro de { list: [...] } (ou {} vazia). */
function asList(data: unknown, key: string): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === 'object') {
    const object = data as Record<string, unknown>;
    if (!Object.keys(object).length) return [];
    for (const candidate of [key, 'list', 'data']) {
      if (Array.isArray(object[candidate])) {
        return object[candidate] as Record<string, unknown>[];
      }
    }
  }
  if (data === null || data === undefined) return [];
  throw new TplinkRequestError(
    'o router mandou uma lista num formato que não conheço',
  );
}

const record = (data: unknown): Record<string, unknown> =>
  data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};

/** As funções do router, sobre uma sessão aberta. */
export class TplinkRouterApi {
  constructor(
    private readonly session: TplinkSession,
    private readonly link: Link | null,
    readonly kind: TplinkKind = 'router',
  ) {}

  private request(path: string, data: string, ignoreResponse = false) {
    return this.session.request(path, data, ignoreResponse);
  }

  /** O que um extensor não tem (o DHCP, as portas e o controlo de acesso são do router). */
  private routerOnly(what: string) {
    if (this.kind === 'extender') {
      throw new TplinkRequestError(
        `isto é um extensor: ${what} são do router principal`,
      );
    }
  }

  /** Um formulário que só alguns firmwares têm: o que falhar vale vazio. */
  private async optional(path: string): Promise<Record<string, unknown>> {
    return record(await this.request(path, 'operation=read').catch(() => null));
  }

  async firmware(): Promise<TplinkFirmware> {
    const data = record(
      await this.request(
        this.kind === 'extender'
          ? 'admin/firmware?form=upgrade'
          : 'admin/firmware?form=upgrade&operation=read',
        'operation=read',
      ),
    );
    return {
      model: text(data.model),
      hardwareVersion: text(data.hardware_version),
      firmwareVersion: text(data.firmware_version),
    };
  }

  /** O estado geral e os dispositivos ligados (guardado STATUS_CACHE_MS). */
  async status(fresh = false): Promise<TplinkStatus> {
    const cached = this.link?.statusCache;
    if (!fresh && cached && Date.now() - cached.at < STATUS_CACHE_MS) {
      return cached.value;
    }
    if (this.kind === 'extender') {
      const status = await this.extenderStatus();
      if (this.link) this.link.statusCache = { at: Date.now(), value: status };
      return status;
    }
    const data = record(
      await this.request(
        'admin/status?form=all&operation=read',
        'operation=read',
      ),
    );
    const flag = (key: string) => toBool(data[key]);
    const status: TplinkStatus = {
      wanMac: data.wan_macaddr ? safeMac(data.wan_macaddr) : null,
      lanMac: data.lan_macaddr ? safeMac(data.lan_macaddr) : null,
      wanIp: data.wan_ipv4_ipaddr ? text(data.wan_ipv4_ipaddr) : null,
      lanIp: data.lan_ipv4_ipaddr ? text(data.lan_ipv4_ipaddr) : null,
      wanGateway: data.wan_ipv4_gateway ? text(data.wan_ipv4_gateway) : null,
      wanUptimeSeconds: toNumber(data.wan_ipv4_uptime),
      wanConnType: data.wan_ipv4_conntype
        ? text(data.wan_ipv4_conntype)
        : data.conn_type
          ? text(data.conn_type)
          : null,
      wanIpv6Enabled: flag('wan_ipv6_enable'),
      lanDhcpEnabled: flag('lan_ipv4_dhcp_enable'),
      cpuUsage: percent(data.cpu_usage),
      memUsage: percent(data.mem_usage),
      wifi: {
        host: {
          '2g': flag('wireless_2g_enable'),
          '5g': flag('wireless_5g_enable'),
          '6g': flag('wireless_6g_enable'),
        },
        guest: {
          '2g': flag('guest_2g_enable'),
          '5g': flag('guest_5g_enable'),
          '6g': flag('guest_6g_enable'),
        },
        iot: {
          '2g': flag('iot_2g_enable'),
          '5g': flag('iot_5g_enable'),
          '6g': flag('iot_6g_enable'),
        },
      },
      mlo: {
        '2g': flag('mlo_host_2g_enable'),
        '5g': flag('mlo_host_5g_enable'),
        '6g': flag('mlo_host_6g_enable'),
      },
      wiredTotal: asList(data.access_devices_wired, 'list').length,
      wifiTotal: asList(data.access_devices_wireless_host, 'list').length,
      guestTotal: asList(data.access_devices_wireless_guest, 'list').length,
      iotTotal: 0,
      devices: [],
    };

    if (status.cpuUsage === null || status.memUsage === null) {
      const perf = record(
        await this.request(
          'admin/status?form=perf&operation=read',
          'operation=read',
        ).catch(() => null),
      );
      status.cpuUsage ??= percent(perf.cpu_usage);
      status.memUsage ??= percent(perf.mem_usage);
    }

    const devices = new Map<string, TplinkDevice>();
    const add = (item: Record<string, unknown>, connection: string) => {
      const mac = safeMac(item.macaddr);
      devices.set(mac, {
        mac,
        ip: text(item.ipaddr),
        hostname: text(item.hostname),
        connection,
        downSpeed: null,
        upSpeed: null,
        signal: null,
        onlineSeconds: null,
        trafficBytes: null,
      });
    };
    for (const item of asList(data.access_devices_wired, 'list')) {
      add(item, wireType(item.wire_type));
    }
    for (const item of asList(data.access_devices_wireless_host, 'list')) {
      add(item, wireType(item.wire_type));
    }
    for (const item of asList(data.access_devices_wireless_guest, 'list')) {
      add(item, wireType(item.wire_type, false));
    }

    // As velocidades e o sinal vêm do "game accelerator" (nem todos os firmwares o têm).
    const smart = await this.request(
      'admin/smart_network?form=game_accelerator&operation=loadDevice',
      'operation=loadDevice',
    ).catch(() => null);
    for (const item of Array.isArray(smart)
      ? (smart as Record<string, unknown>[])
      : []) {
      if (!item.mac) continue;
      const mac = safeMac(item.mac);
      let device = devices.get(mac);
      if (!device) {
        const online = toNumber(item.onlineTime ?? item.online_time);
        if (!online) continue;
        const connection = wireType(item.deviceTag, !item.isGuest);
        device = {
          mac,
          ip: text(item.ip),
          hostname: text(item.deviceName),
          connection,
          downSpeed: null,
          upSpeed: null,
          signal: null,
          onlineSeconds: null,
          trafficBytes: null,
        };
        devices.set(mac, device);
        if (connection.startsWith('iot')) status.iotTotal += 1;
        else if (connection.startsWith('guest')) status.guestTotal += 1;
        else if (connection.startsWith('host')) status.wifiTotal += 1;
      }
      device.downSpeed = toNumber(item.downloadSpeed ?? item.downSpeed);
      device.upSpeed = toNumber(item.uploadSpeed ?? item.upSpeed);
      device.onlineSeconds = toNumber(item.onlineTime ?? item.online_time);
      device.trafficBytes = toNumber(item.trafficUsage ?? item.trafficUsed);
      device.signal = toNumber(item.signal);
    }

    await this.meshPlacement(devices);
    status.devices = [...devices.values()];
    if (this.link) this.link.statusCache = { at: Date.now(), value: status };
    return status;
  }

  async wifi(network: TplinkNetwork, band: TplinkBand): Promise<TplinkWifi> {
    if (this.kind === 'extender' && network !== 'host') {
      return this.extenderGuestWifi(network, band);
    }
    const name = wifiForm(network, band);
    const data = record(
      await this.request(`admin/wireless?form=${name}`, 'operation=read'),
    );
    const value = (key: string) => data[`${name}_${key}`] ?? data[key];
    return {
      network,
      band,
      enabled: toBool(value('enable')),
      ssid: value('ssid') === undefined ? null : text(value('ssid')),
      hidden: toBool(value('hidden')),
      encryption:
        value('encryption') === undefined ? null : text(value('encryption')),
      channel: toNumber(value('channel')),
    };
  }

  /** Liga ou desliga uma rede e muda o nome ou o esconder (o resto fica). */
  async setWifi(
    network: TplinkNetwork,
    band: TplinkBand,
    change: { enabled?: boolean; ssid?: string; hidden?: boolean },
  ): Promise<void> {
    if (this.kind === 'extender') {
      await this.extenderSetWifi(network, band, change);
      if (this.link) this.link.statusCache = null;
      return;
    }
    const name = wifiForm(network, band);
    const onlyEnable = change.ssid === undefined && change.hidden === undefined;
    const key = (field: string) => (onlyEnable ? field : `${name}_${field}`);
    const params = new URLSearchParams({ operation: 'write' });
    if (change.enabled !== undefined)
      params.set(key('enable'), change.enabled ? 'on' : 'off');
    if (change.ssid !== undefined) params.set(key('ssid'), change.ssid);
    if (change.hidden !== undefined)
      params.set(key('hidden'), change.hidden ? 'on' : 'off');
    await this.request(`admin/wireless?form=${name}`, params.toString());
    if (this.link) this.link.statusCache = null;
  }

  async reboot(): Promise<void> {
    await this.request('admin/system?form=reboot', 'operation=write', true);
    if (this.link) {
      this.link.session = null;
      this.link.statusCache = null;
    }
  }

  async leases(): Promise<TplinkLease[]> {
    const data = await this.request(
      this.kind === 'extender'
        ? 'admin/dhcps?form=client'
        : 'admin/dhcps?form=client&operation=load',
      'operation=load',
    );
    // Nos extensores vem às vezes como objeto com um cliente por chave.
    const rows =
      this.kind === 'extender' &&
      data &&
      typeof data === 'object' &&
      !Array.isArray(data)
        ? Object.values(data).map(record)
        : asList(data, 'dhcp_clients');
    return rows
      .filter((item) => item.macaddr)
      .map((item) => ({
        mac: safeMac(item.macaddr),
        ip: text(item.ipaddr),
        name: text(item.name),
        leaseTime: text(item.leasetime),
      }));
  }

  private async reservationRows() {
    this.routerOnly('as reservas de IP');
    const data = await this.request(
      'admin/dhcps?form=reservation&operation=load',
      'operation=load',
    );
    return asList(data, 'list');
  }

  async reservations(): Promise<TplinkReservation[]> {
    return (await this.reservationRows()).map((item) => ({
      mac: safeMac(item.mac),
      ip: text(item.ip),
      name: text(item.comment) || text(item.hostname),
      enabled: toBool(item.enable),
    }));
  }

  /** Reserva um IP a um MAC; recusa um MAC ou IP já reservado e confirma que ficou. */
  async addReservation(mac: string, ip: string, name: string): Promise<void> {
    const wanted = normalizeMac(mac);
    if (!isIpv4(ip)) throw new TplinkRequestError(`IP inválido: ${ip}`);
    const rows = await this.reservationRows();
    for (const row of rows) {
      if (safeMac(row.mac) === wanted) {
        throw new TplinkRequestError(
          `já há uma reserva para ${wanted} (${text(row.ip)})`,
        );
      }
      if (text(row.ip).trim() === ip.trim()) {
        throw new TplinkRequestError(
          `o IP ${ip} já está reservado para ${text(row.mac)}`,
        );
      }
    }
    const row = {
      mac: wanted,
      ip: ip.trim(),
      comment: name,
      hostname: name,
      enable: 'on',
    };
    await this.request(
      'admin/dhcps?form=reservation',
      new URLSearchParams({
        operation: 'insert',
        new: JSON.stringify(row),
      }).toString(),
    );
    const after = await this.reservationRows();
    if (!after.some((item) => safeMac(item.mac) === wanted)) {
      throw new TplinkRequestError(
        'o router aceitou a reserva mas não a guardou (a tabela pode estar cheia)',
      );
    }
  }

  async deleteReservation(mac: string): Promise<void> {
    const wanted = normalizeMac(mac);
    const rows = await this.reservationRows();
    const index = rows.findIndex((item) => safeMac(item.mac) === wanted);
    if (index < 0)
      throw new TplinkRequestError(`não há reserva para ${wanted}`);
    await this.request(
      'admin/dhcps?form=reservation',
      new URLSearchParams({
        operation: 'remove',
        key: text(rows[index].mac),
        index: String(index),
      }).toString(),
    );
    const after = await this.reservationRows();
    if (after.some((item) => safeMac(item.mac) === wanted)) {
      throw new TplinkRequestError(
        'o router aceitou apagar a reserva mas ela continua lá',
      );
    }
  }

  private async portForwardRows() {
    this.routerOnly('os reencaminhamentos de portas');
    const data = await this.request(
      'admin/nat?form=vs&operation=load',
      'operation=load',
    );
    return asList(data, 'data');
  }

  async portForwards(): Promise<TplinkPortForward[]> {
    return (await this.portForwardRows()).map((item) => ({
      name: text(item.name),
      ip: text(item.ipaddr),
      externalPort: text(item.external_port),
      internalPort: text(item.internal_port),
      protocol: text(item.protocol).toUpperCase(),
      enabled: toBool(item.enable),
    }));
  }

  async addPortForward(rule: {
    name: string;
    ip: string;
    externalPort: string;
    internalPort: string;
    protocol: 'TCP' | 'UDP' | 'ALL';
  }): Promise<void> {
    this.routerOnly('os reencaminhamentos de portas');
    if (!rule.name.trim())
      throw new TplinkRequestError('falta o nome da regra');
    if (!isIpv4(rule.ip))
      throw new TplinkRequestError(`IP inválido: ${rule.ip}`);
    const port = (value: string, range: boolean) => {
      const parts = value.split('-').map((part) => part.trim());
      const ok =
        parts.length <= (range ? 2 : 1) &&
        parts.every(
          (part) => /^\d+$/.test(part) && +part >= 1 && +part <= 65535,
        ) &&
        (parts.length === 1 || +parts[0] <= +parts[1]);
      if (!ok) throw new TplinkRequestError(`porta inválida: ${value}`);
      return parts.join('-');
    };
    const row = {
      name: rule.name.trim(),
      ipaddr: rule.ip.trim(),
      external_port: port(rule.externalPort, true),
      internal_port: port(rule.internalPort, false),
      protocol: rule.protocol,
      enable: 'on',
    };
    await this.request(
      'admin/nat?form=vs',
      new URLSearchParams({
        operation: 'insert',
        new: JSON.stringify(row),
      }).toString(),
    );
  }

  async deletePortForward(name: string): Promise<void> {
    const rows = await this.portForwardRows();
    const index = rows.findIndex((item) => text(item.name) === name);
    if (index < 0)
      throw new TplinkRequestError(`não há nenhuma regra «${name}»`);
    await this.request(
      'admin/nat?form=vs',
      new URLSearchParams({
        operation: 'remove',
        key: name,
        index: String(index),
      }).toString(),
    );
  }

  async accessControl(): Promise<{
    enabled: boolean;
    mode: 'blacklist' | 'whitelist';
  }> {
    this.routerOnly('o controlo de acesso e os bloqueios');
    const enable = record(
      await this.request('admin/access_control?form=enable', 'operation=read'),
    );
    const mode = record(
      await this.request('admin/access_control?form=mode', 'operation=read'),
    );
    return {
      enabled: enable.enable === 'on',
      mode: mode.access_mode === 'white' ? 'whitelist' : 'blacklist',
    };
  }

  async setAccessControl(change: {
    enabled?: boolean;
    mode?: 'blacklist' | 'whitelist';
  }): Promise<void> {
    this.routerOnly('o controlo de acesso e os bloqueios');
    if (change.enabled === true) {
      await this.request(
        'admin/access_control?form=enable',
        new URLSearchParams({ operation: 'write', enable: 'on' }).toString(),
      );
    }
    if (change.mode) {
      await this.request(
        'admin/access_control?form=mode',
        new URLSearchParams({
          operation: 'write',
          access_mode: change.mode === 'whitelist' ? 'white' : 'black',
        }).toString(),
      );
    }
    if (change.enabled === false) {
      await this.request(
        'admin/access_control?form=enable',
        new URLSearchParams({ operation: 'write', enable: 'off' }).toString(),
      );
    }
  }

  private async blockedRows() {
    this.routerOnly('o controlo de acesso e os bloqueios');
    const data = await this.request(
      'admin/access_control?form=black_list',
      'operation=load',
    );
    return asList(data, 'list');
  }

  async blocked(): Promise<{ mac: string; name: string }[]> {
    return (await this.blockedRows())
      .map((item) => ({ mac: safeMac(item.mac), name: text(item.name) }))
      .filter((item) => item.mac && item.mac !== '00-00-00-00-00-00');
  }

  /** Põe um MAC na lista negra (não liga o controlo de acesso; isso é o setAccessControl). */
  async block(mac: string, name: string): Promise<void> {
    const wanted = normalizeMac(mac);
    const rows = await this.blockedRows();
    if (rows.some((item) => safeMac(item.mac) === wanted)) return;
    await this.request(
      'admin/access_control?form=black_list',
      new URLSearchParams({
        operation: 'insert',
        new: JSON.stringify({
          name: (name || wanted).slice(0, 64),
          mac: wanted,
        }),
        index: '0',
      }).toString(),
    );
    const after = await this.blockedRows();
    if (!after.some((item) => safeMac(item.mac) === wanted)) {
      throw new TplinkRequestError(
        'o router aceitou bloquear mas não guardou (a lista pode estar cheia)',
      );
    }
  }

  async unblock(mac: string): Promise<void> {
    const wanted = normalizeMac(mac);
    const rows = await this.blockedRows();
    const index = rows.findIndex((item) => safeMac(item.mac) === wanted);
    if (index < 0) return;
    await this.request(
      'admin/access_control?form=black_list',
      new URLSearchParams({
        operation: 'remove',
        key: text(rows[index].mac),
        index: String(index),
      }).toString(),
    );
    const after = await this.blockedRows();
    if (after.some((item) => safeMac(item.mac) === wanted)) {
      throw new TplinkRequestError(
        'o router aceitou desbloquear mas o dispositivo continua na lista',
      );
    }
  }

  /** As portas (Internet e LAN): ligadas ou não, velocidade e duplex. */
  async ports(): Promise<TplinkPort[]> {
    if (this.kind === 'extender') return [];
    const data = await this.request(
      'admin/status?form=router',
      'operation=read',
    ).catch(() => null);
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    const fields = new Map<
      number,
      { name: string; values: Record<string, unknown> }
    >();
    for (const row of rows.map(record)) {
      const name = text(row.name).toLowerCase();
      const match = /^(wan|lan)(\d*)$/.exec(name);
      if (match) {
        const port = Number(match[2] || 0);
        fields.set(port, {
          name,
          values: { ...fields.get(port)?.values, ...row },
        });
        continue;
      }
      for (const [key, value] of Object.entries(row)) {
        const flat = /^(wan|lan(\d+))_(status|speed|duplex)$/.exec(key);
        if (!flat) continue;
        const port = Number(flat[2] || 0);
        const entry = fields.get(port) ?? {
          name: port ? `lan${port}` : 'wan',
          values: {},
        };
        entry.values[flat[3]] = value;
        fields.set(port, entry);
      }
    }
    return [...fields.entries()]
      .sort(([a], [b]) => a - b)
      .map(([port, { name, values }]) => {
        const status = text(values.status).toLowerCase();
        let speed = toNumber(values.speed);
        if (!speed || speed <= 0) speed = null;
        let duplex: string | null = text(values.duplex).toLowerCase();
        if (duplex !== 'full' && duplex !== 'half') duplex = null;
        let linkUp: boolean | null;
        if (status === 'unconnected' || status === 'unplugged') {
          linkUp = false;
          speed = null;
          duplex = null;
        } else if (speed !== null) linkUp = true;
        else
          linkUp =
            status === 'connected'
              ? true
              : status === 'disconnected'
                ? false
                : null;
        return { port, name, linkUp, speedMbps: speed, duplex };
      });
  }

  /**
   * No mesh, a que nó está ligado cada dispositivo (como o get_status da biblioteca): o router
   * pergunta a cada nó os clientes dele (mesh_sclient_detail). Quem está num extensor e não veio
   * no estado geral junta-se à lista.
   */
  private async meshPlacement(devices: Map<string, TplinkDevice>) {
    const nodes = await this.request(
      'admin/easymesh_network?form=get_mesh_device_list_all&operation=read',
      'operation=read',
    ).catch(() => null);
    if (!Array.isArray(nodes)) return;
    for (const node of nodes.map(record)) {
      const mac = text(node.mac);
      if (!mac) continue;
      const satellite = text(node.role) === 'satellite_router';
      const detail = record(
        await this.request(
          `admin/easymesh_network?form=mesh_sclient_detail&operation=read&mac=${encodeURIComponent(mac)}`,
          `operation=read&mac=${encodeURIComponent(mac)}`,
        ).catch(() => null),
      );
      const clients = Array.isArray(detail.mesh_nclient_list)
        ? detail.mesh_nclient_list.map(record)
        : [];
      for (const client of clients) {
        if (!client.mac) continue;
        const clientMac = safeMac(client.mac);
        let device = devices.get(clientMac);
        if (!device && satellite) {
          device = {
            mac: clientMac,
            ip: text(client.ip),
            hostname: text(client.name),
            connection: toBool(client.is_wired) ? 'wired' : 'unknown',
            downSpeed: null,
            upSpeed: null,
            signal: null,
            onlineSeconds: null,
            trafficBytes: null,
          };
          devices.set(clientMac, device);
        }
        if (!device) continue;
        if (satellite) {
          device.apName = text(node.name) || text(node.model) || 'extensor';
          device.viaSatellite = true;
          const signal = toNumber(client.signal_strength);
          if (signal !== null) device.signal = signal;
        } else if (!device.apName) {
          device.apName = text(node.name) || text(node.model) || 'router';
          device.viaSatellite = false;
        }
      }
    }
  }

  /** Os nós EasyMesh (vazio num router sem mesh). */
  async mesh(): Promise<TplinkMeshNode[]> {
    if (this.kind === 'extender') return [];
    const data = await this.request(
      'admin/easymesh_network?form=get_mesh_device_list_all&operation=read',
      'operation=read',
    ).catch(() => null);
    return (Array.isArray(data) ? data : []).map(record).map((item) => ({
      name: item.name ? text(item.name) : null,
      model: item.model ? text(item.model) : null,
      role: item.role ? text(item.role) : null,
      status: item.status ? text(item.status) : null,
      mac: item.mac ? safeMac(item.mac) : null,
      ip: item.ip ? text(item.ip) : null,
      clients: toNumber(item.client_num),
    }));
  }

  /** Renova (true) ou liberta (false) o IP da Internet por DHCP. */

  // ── Extensores (como o TplinkRE813XERouter) ─────────────────────────────

  /** O estado de um extensor: o Wi-Fi que dá, os clientes, o IP dele, CPU e memória. */
  private async extenderStatus(): Promise<TplinkStatus> {
    const ap = record(
      await this.request('admin/status?form=ap_status', 'operation=read'),
    );
    const lan = await this.optional('admin/network?form=lan_ipv4');
    const device = await this.optional('admin/status?form=status_device');
    const guestSettings = await this.optional(
      'admin/extend?form=guest_settings',
    );
    const guests = await this.request(
      'admin/status?form=guest',
      'operation=read',
    ).catch(() => null);
    const perf = await this.optional('admin/status?form=perf');
    const flag = (value: unknown) => toBool(value);
    const devices = new Map<string, TplinkDevice>();
    const add = (item: Record<string, unknown>, host: boolean) => {
      const mac = safeMac(item.mac);
      devices.set(mac, {
        mac,
        ip: text(item.ipaddr ?? item.ip),
        hostname: text(item.name),
        connection: wireType(item.type, host),
        downSpeed: null,
        upSpeed: null,
        signal: toNumber(item.signal ?? item.rssi),
        onlineSeconds: null,
        trafficBytes: null,
      });
    };
    for (const item of asList(ap.wirelessGrid, 'list')) add(item, true);
    const guestRows = Array.isArray(guests) ? guests.map(record) : [];
    for (const item of guestRows) add(item, false);
    // O RE225BE dá ipaddr/macaddr; o RE813XE lan_ip/lan_macaddr; o RE700X só o wired_ip.
    const lanIpValue = lan.lan_ip ?? lan.ipaddr ?? device.wired_ip;
    const lanIp = lanIpValue ? text(lanIpValue) : null;
    const lanMacValue = lan.lan_macaddr ?? lan.macaddr;
    return {
      wanMac: null,
      lanMac: lanMacValue ? safeMac(lanMacValue) : null,
      wanIp: null,
      lanIp,
      wanGateway: null,
      wanUptimeSeconds: null,
      wanConnType: null,
      wanIpv6Enabled: null,
      lanDhcpEnabled: null,
      cpuUsage: percent(perf.cpu_usage),
      memUsage: percent(perf.mem_usage),
      wifi: {
        host: {
          '2g': flag(ap.wireless_2g_enable),
          '5g': flag(ap.wireless_5g_enable),
          '6g': flag(ap.wireless_6g_enable),
        },
        guest: {
          '2g': flag(guestSettings.enable_2g),
          '5g': flag(guestSettings.enable_5g),
          '6g': flag(guestSettings.enable_6g),
        },
        iot: {},
      },
      mlo: {},
      wiredTotal: 0,
      wifiTotal:
        toNumber(ap.wirelessCount) ?? asList(ap.wirelessGrid, 'list').length,
      guestTotal: guestRows.length,
      iotTotal: 0,
      devices: [...devices.values()],
    };
  }

  /** A rede de convidados de um extensor (admin/extend?form=guest_settings). */
  private async extenderGuestWifi(
    network: TplinkNetwork,
    band: TplinkBand,
  ): Promise<TplinkWifi> {
    if (network !== 'guest') {
      throw new TplinkRequestError(
        'isto é um extensor: não tem rede IoT própria',
      );
    }
    const data = record(
      await this.request('admin/extend?form=guest_settings', 'operation=read'),
    );
    return {
      network,
      band,
      enabled: toBool(data[`enable_${band}`]),
      ssid:
        data[`ssid_${band}`] === undefined ? null : text(data[`ssid_${band}`]),
      hidden: toBool(data[`hide_${band}`]),
      encryption: data.sec === undefined ? null : text(data.sec),
      channel: null,
    };
  }

  /**
   * Muda uma rede de um extensor. A principal liga-se e desliga-se com disabled_all (o inverso
   * do enable, como a página dele faz); ligar manda a configuração toda do rádio. A de
   * convidados vai pelo guest_settings, com o resto como estava.
   */
  private async extenderSetWifi(
    network: TplinkNetwork,
    band: TplinkBand,
    change: { enabled?: boolean; ssid?: string; hidden?: boolean },
  ): Promise<void> {
    if (network === 'iot') {
      throw new TplinkRequestError(
        'isto é um extensor: não tem rede IoT própria',
      );
    }
    if (network === 'guest') {
      const current = record(
        await this.request(
          'admin/extend?form=guest_settings',
          'operation=read',
        ),
      );
      const payload: Record<string, string> = {};
      for (const [key, value] of Object.entries(current)) {
        if (value !== null && value !== undefined) payload[key] = text(value);
      }
      if (change.enabled !== undefined)
        payload[`enable_${band}`] = change.enabled ? 'on' : 'off';
      if (change.ssid !== undefined) payload[`ssid_${band}`] = change.ssid;
      if (change.hidden !== undefined)
        payload[`hide_${band}`] = change.hidden ? 'on' : 'off';
      await this.request(
        'admin/extend?form=guest_settings',
        new URLSearchParams({ operation: 'write', ...payload }).toString(),
      );
      return;
    }
    const form = `admin/wireless?form=wireless_${band}`;
    const current = record(await this.request(form, 'operation=read'));
    const pick = (key: string, override?: string) =>
      override !== undefined
        ? override
        : current[key] === undefined
          ? undefined
          : text(current[key]);
    const turningOn = change.enabled ?? toBool(current.enable) ?? false;
    const fields: Record<string, string | undefined> = {
      twt: pick('twt'),
      ofdma: pick('ofdma'),
      mimo: pick('mimo'),
      enable:
        change.enabled === undefined
          ? undefined
          : change.enabled
            ? 'on'
            : 'off',
    };
    if (turningOn) {
      Object.assign(fields, {
        ssid: pick('ssid', change.ssid),
        hidden: pick(
          'hidden',
          change.hidden === undefined
            ? undefined
            : change.hidden
              ? 'on'
              : 'off',
        ),
        encryption: pick('encryption'),
        psk_version: pick('psk_version'),
        psk_cipher: pick('psk_cipher'),
        psk_key: pick('psk_key'),
        hwmode: pick('hwmode'),
        htmode: pick('htmode'),
        channel: pick('channel'),
        ...(band === '6g'
          ? { pscEnable: pick('pscEnable') ?? 'on' }
          : { txpower: pick('txpower') }),
      });
    }
    fields.disabled_all = turningOn ? 'off' : 'on';
    const params = new URLSearchParams({ operation: 'write' });
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) params.set(key, value);
    }
    await this.request(form, params.toString());
  }

  /** Como o extensor chega ao router principal (o backhaul); null num router. */
  async repeater(): Promise<TplinkRepeater | null> {
    if (this.kind !== 'extender') return null;
    const root = await this.optional('admin/status?form=rootAP');
    const repeater = await this.optional('admin/status?form=repeater');
    const mesh = await this.optional('admin/easy_mesh?form=mesh_info');
    const ap = await this.optional('admin/status?form=ap_status');
    const band = (suffix: '24g' | '5g', rates: '2g' | '5g') => {
      const connection = repeater[`repeater_conn_${suffix}`];
      // Sem o formulário repeater (ex.: RE225BE), uma banda está ligada quando o router
      // principal tem MAC e sinal nela.
      const connected =
        connection !== undefined
          ? /^connected$|^1$|^on$/i.test(text(connection))
          : Boolean(text(root[`ap_mac_${suffix}`])) &&
            (toNumber(root[`ap_rssi_${suffix}`]) ?? 0) !== 0;
      return {
        connection: connection === undefined ? null : text(connection),
        connected,
        ssid:
          root[`ap_ssid_${suffix}`] === undefined
            ? null
            : text(root[`ap_ssid_${suffix}`]),
        rssi: connected ? toNumber(root[`ap_rssi_${suffix}`]) : null,
        rxRateMbps: connected ? toNumber(root[`${rates}rxrate`]) : null,
        txRateMbps: connected ? toNumber(root[`${rates}txrate`]) : null,
      };
    };
    const wiredIp = text(root.ap_ip_wired_mesh);
    const internet = repeater.internet_status ?? ap.internet_status;
    return {
      wired: {
        connected: Boolean(
          text(root.ap_mac_wired_mesh) && wiredIp && wiredIp !== '0.0.0.0',
        ),
        ip: wiredIp && wiredIp !== '0.0.0.0' ? wiredIp : null,
      },
      band2g: band('24g', '2g'),
      band5g: band('5g', '5g'),
      internetStatus: internet === undefined ? null : text(internet),
      meshEnabled: toBool(mesh.mesh_enable),
      meshSync: mesh.sync_status === undefined ? null : text(mesh.sync_status),
    };
  }

  async renewWan(renew: boolean): Promise<void> {
    this.routerOnly('a ligação à Internet e o IP dela');
    const operation = renew ? 'renew' : 'release';
    await this.request(
      `admin/network?form=wan_ipv4_dynamic&operation=${operation}`,
      `operation=${operation}`,
    );
  }
}
