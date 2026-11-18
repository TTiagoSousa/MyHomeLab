import { Agent } from 'https';
import axios, { AxiosInstance } from 'axios';

export interface ProxmoxNode {
  node: string;
}

export interface ProxmoxGuest {
  vmid: number;
  name: string;
  status: string;
}

export interface ProxmoxGuestStatus {
  status: string;
  mem: number;
  maxmem: number;
  cpu: number;
}

export type GuestKind = 'qemu' | 'lxc';

export interface ProxmoxGuestRef {
  node: string;
  kind: GuestKind;
  guest: ProxmoxGuest;
}

/** Os dados de ligação de um servidor, já com o segredo em claro. */
export interface ProxmoxConnection {
  /** O id da ligação no MyHomeLab (para ligar documentos ao servidor). */
  id?: string;
  name: string;
  host: string;
  port: number;
  /** `utilizador@realm!nome`, tal como o Proxmox o mostra. */
  tokenId: string;
  tokenSecret: string;
  verifyTls: boolean;
}

/**
 * Uma linha de /cluster/resources — o Proxmox devolve nós, VMs, containers e
 * storages numa só chamada, cada um com os campos que lhe dizem respeito.
 */
export interface ProxmoxResource {
  id: string;
  /** 'node', 'qemu', 'lxc', 'storage', ou outro (ex: 'sdn') que se ignora. */
  type: string;
  node?: string;
  name?: string;
  storage?: string;
  status?: string;
  vmid?: number;
  template?: number;
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  netin?: number;
  netout?: number;
  uptime?: number;
  plugintype?: string;
  content?: string;
  shared?: number;
}

/** /nodes/{node}/status — o detalhe do próprio servidor físico. */
export interface ProxmoxNodeStatus {
  cpu: number;
  cpuinfo?: { model?: string; cpus?: number; cores?: number; sockets?: number };
  memory: { used: number; total: number; free?: number };
  swap?: { used: number; total: number };
  rootfs?: { used: number; total: number };
  loadavg?: string[];
  uptime: number;
  pveversion?: string;
  kversion?: string;
}

/** Um ponto de /nodes/{node}/rrddata. Os campos podem faltar em pontos sem dados. */
export interface ProxmoxRrdPoint {
  time: number;
  cpu?: number;
  maxcpu?: number;
  memused?: number;
  memtotal?: number;
  netin?: number;
  netout?: number;
  loadavg?: number;
  iowait?: number;
}

/** Uma linha de /nodes/{node}/disks/list — os discos físicos do nó. */
export interface ProxmoxDisk {
  devpath: string;
  model?: string;
  serial?: string;
  vendor?: string;
  type?: string;
  size?: number;
  health?: string;
  /** % de vida que resta (SSD/NVMe), ou "N/A". */
  wearout?: number | string;
  used?: string;
  rpm?: number | string;
}

/** /nodes/{node}/disks/smart — atributos ATA, ou o texto do smartctl (NVMe). */
export interface ProxmoxSmart {
  health?: string;
  /** 'ata' (tabela de atributos) ou 'text' (NVMe, SAS). */
  type?: string;
  attributes?: {
    id: number | string;
    name: string;
    raw: string;
    value?: number | string;
    threshold?: number | string;
    fail?: string;
  }[];
  text?: string;
}

/** Uma linha de /nodes/{node}/disks/zfs. */
export interface ProxmoxZfsPool {
  name: string;
  health: string;
  size: number;
  alloc: number;
  free: number;
  frag?: number;
}

export type RrdTimeframe = 'hour' | 'day' | 'week' | 'month';

/** Um snapshot de uma VM ou CT. "current" é o estado atual, não um snapshot. */
export interface ProxmoxSnapshot {
  name: string;
  description?: string;
  snaptime?: number;
  parent?: string;
}

/** Um storage de um nó, de /nodes/{node}/storage. */
export interface ProxmoxStorage {
  storage: string;
  type: string;
  content: string;
  avail?: number;
  total?: number;
  active?: number;
}

/** Um sistema de ficheiros dentro de uma VM, pelo QEMU guest agent (agent/get-fsinfo). */
export interface ProxmoxGuestFs {
  name: string;
  mountpoint: string;
  type: string;
  'total-bytes'?: number;
  'used-bytes'?: number;
}

export type GuestPowerAction =
  'start' | 'shutdown' | 'stop' | 'reboot' | 'suspend' | 'resume';

/** Um pacote com atualização à espera, de /nodes/{node}/apt/update. */
export interface ProxmoxAptUpdate {
  Package: string;
  Title?: string;
  OldVersion?: string;
  Version: string;
  Origin?: string;
}

export interface ProxmoxClient {
  version(): Promise<{ version: string; release?: string }>;
  listNodes(): Promise<ProxmoxNode[]>;
  listGuests(): Promise<ProxmoxGuestRef[]>;
  findGuest(name: string): Promise<ProxmoxGuestRef | null>;
  getGuestStatus(ref: ProxmoxGuestRef): Promise<ProxmoxGuestStatus>;
  /** Os discos dentro de uma VM, pelo guest agent (sem agente → erro). */
  guestFsInfo(ref: ProxmoxGuestRef): Promise<ProxmoxGuestFs[]>;
  clusterResources(): Promise<ProxmoxResource[]>;
  nodeStatus(node: string): Promise<ProxmoxNodeStatus>;
  nodeHistory(
    node: string,
    timeframe: RrdTimeframe,
  ): Promise<ProxmoxRrdPoint[]>;
  listDisks(node: string): Promise<ProxmoxDisk[]>;
  diskSmart(node: string, devpath: string): Promise<ProxmoxSmart>;
  listZfsPools(node: string): Promise<ProxmoxZfsPool[]>;
  aptUpdates(node: string): Promise<ProxmoxAptUpdate[]>;
  /** O changelog Debian de um pacote (a versão por instalar), como o `apt changelog`. */
  aptChangelog(node: string, name: string): Promise<string>;

  // Escrita (nível 1): precisa de um token com permissões nas VMs/CTs.
  guestConfig(ref: ProxmoxGuestRef): Promise<Record<string, unknown>>;
  guestPower(ref: ProxmoxGuestRef, action: GuestPowerAction): Promise<string>;
  listSnapshots(ref: ProxmoxGuestRef): Promise<ProxmoxSnapshot[]>;
  createSnapshot(
    ref: ProxmoxGuestRef,
    name: string,
    description?: string,
  ): Promise<string>;
  rollbackSnapshot(ref: ProxmoxGuestRef, name: string): Promise<string>;
  deleteSnapshot(ref: ProxmoxGuestRef, name: string): Promise<string>;
  listStorages(node: string, content?: string): Promise<ProxmoxStorage[]>;
  backupNow(ref: ProxmoxGuestRef, storage?: string): Promise<string>;
  setConfig(
    ref: ProxmoxGuestRef,
    changes: Record<string, string | number>,
  ): Promise<unknown>;
  resizeDisk(
    ref: ProxmoxGuestRef,
    disk: string,
    size: string,
  ): Promise<unknown>;
  /** Espera que uma tarefa (UPID) acabe; devolve o exitstatus ("OK" quando correu bem). */
  waitTask(node: string, upid: string, timeoutMs?: number): Promise<string>;
}

/**
 * Tira o que as pessoas costumam colar a mais no endereço — `https://`, a porta,
 * uma barra no fim — para o host ficar só host.
 */
export function normalizeHost(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}

/**
 * Um cliente por servidor. Antes havia um só, lido das variáveis PROXMOX_* do
 * servidor; agora os servidores vêm da base de dados (Apps ligadas → Proxmox) e
 * cada utilizador pode ter vários.
 */
export function createProxmoxClient(conn: ProxmoxConnection): ProxmoxClient {
  const http: AxiosInstance = axios.create({
    baseURL: `https://${normalizeHost(conn.host)}:${conn.port}/api2/json`,
    headers: {
      Authorization: `PVEAPIToken=${conn.tokenId.trim()}=${conn.tokenSecret.trim()}`,
    },
    // O Proxmox usa por norma um certificado self-signed na LAN; só se valida a
    // cadeia quando o utilizador o pede.
    httpsAgent: new Agent({ rejectUnauthorized: conn.verifyTls }),
    timeout: 10000,
  });

  async function request<T>(
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    data?: Record<string, string | number | undefined>,
    timeout?: number,
  ): Promise<T> {
    try {
      const body = data
        ? new URLSearchParams(
            Object.entries(data)
              .filter(([, value]) => value !== undefined)
              .map(([key, value]) => [key, String(value)]),
          )
        : undefined;
      const response = await http.request<{ data: T }>({
        method,
        url: path,
        data: body,
        timeout,
      });
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const where = `${conn.name} (${normalizeHost(conn.host)}:${conn.port})`;
        if (error.response?.status === 401) {
          throw new Error(
            `O Proxmox ${where} recusou as credenciais (401). O token expirou, foi ` +
              'revogado ou está mal escrito — gera um novo em Datacenter > Permissions > ' +
              'API Tokens e troca-o em Apps ligadas → Proxmox.',
          );
        }
        if (error.response?.status === 403 && method !== 'get') {
          throw new Error(
            `O token de ${where} não tem permissão para mexer nisto (${path}, 403). Para o ` +
              'MyHomeLab controlar as máquinas, dá-lhe o papel PVEVMAdmin em Datacenter > ' +
              'Permissions (ou desliga "Privilege Separation").',
          );
        }
        if (error.response?.status === 403) {
          throw new Error(
            `O token de ${where} não tem permissão para ${path} (403). Dá-lhe o papel ` +
              'PVEAuditor em Datacenter > Permissions, ou desliga "Privilege Separation".',
          );
        }
        if (!error.response) {
          throw new Error(
            `Não foi possível contactar o Proxmox ${where} — verifica se está ligado e ` +
              `acessível a partir do MyHomeLab. (${error.message})`,
          );
        }
        const detail = (
          error.response.data as { errors?: unknown; message?: string }
        )?.errors;
        throw new Error(
          `O Proxmox ${where} respondeu com ${error.response.status} em ${path}` +
            (detail ? `: ${JSON.stringify(detail)}` : '.'),
        );
      }
      throw error;
    }
  }

  const get = <T>(path: string, timeout?: number) =>
    request<T>('get', path, undefined, timeout);

  const guestPath = (ref: ProxmoxGuestRef) =>
    `/nodes/${encodeURIComponent(ref.node)}/${ref.kind}/${ref.guest.vmid}`;

  const listNodes = () => get<ProxmoxNode[]>('/nodes');

  async function listGuests(): Promise<ProxmoxGuestRef[]> {
    const guests: ProxmoxGuestRef[] = [];
    for (const node of await listNodes()) {
      for (const kind of ['qemu', 'lxc'] as GuestKind[]) {
        const found = await get<ProxmoxGuest[]>(`/nodes/${node.node}/${kind}`);
        for (const guest of found)
          guests.push({ node: node.node, kind, guest });
      }
    }
    return guests;
  }

  return {
    version: () => get<{ version: string; release?: string }>('/version'),
    // A lista de atualizações demora mais a responder do que o resto.
    aptUpdates: (node) =>
      get<ProxmoxAptUpdate[]>(`/nodes/${node}/apt/update`, 60_000),
    aptChangelog: (node, name) =>
      get<string>(
        `/nodes/${encodeURIComponent(node)}/apt/changelog?name=${encodeURIComponent(name)}`,
        60_000,
      ),
    listNodes,
    listGuests,
    guestConfig: (ref) =>
      get<Record<string, unknown>>(`${guestPath(ref)}/config`),
    guestPower: (ref, action) =>
      request<string>('post', `${guestPath(ref)}/status/${action}`, {}),
    listSnapshots: (ref) =>
      get<ProxmoxSnapshot[]>(`${guestPath(ref)}/snapshot`),
    createSnapshot: (ref, name, description) =>
      request<string>('post', `${guestPath(ref)}/snapshot`, {
        snapname: name,
        description,
      }),
    rollbackSnapshot: (ref, name) =>
      request<string>(
        'post',
        `${guestPath(ref)}/snapshot/${encodeURIComponent(name)}/rollback`,
        {},
      ),
    deleteSnapshot: (ref, name) =>
      request<string>(
        'delete',
        `${guestPath(ref)}/snapshot/${encodeURIComponent(name)}`,
      ),
    listStorages: (node, content) =>
      get<ProxmoxStorage[]>(
        `/nodes/${encodeURIComponent(node)}/storage${content ? `?content=${content}` : ''}`,
      ),
    backupNow: (ref, storage) =>
      request<string>('post', `/nodes/${encodeURIComponent(ref.node)}/vzdump`, {
        vmid: ref.guest.vmid,
        mode: 'snapshot',
        compress: 'zstd',
        storage,
      }),
    setConfig: (ref, changes) =>
      request('put', `${guestPath(ref)}/config`, changes),
    resizeDisk: (ref, disk, size) =>
      request('put', `${guestPath(ref)}/resize`, { disk, size }),
    async waitTask(node, upid, timeoutMs = 120_000) {
      const started = Date.now();
      for (;;) {
        const task = await get<{ status: string; exitstatus?: string }>(
          `/nodes/${encodeURIComponent(node)}/tasks/${encodeURIComponent(upid)}/status`,
        );
        if (task.status === 'stopped') return task.exitstatus ?? 'OK';
        if (Date.now() - started > timeoutMs) return 'a correr';
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    },
    async findGuest(name) {
      const needle = name.toLowerCase();
      const guests = await listGuests();
      return (
        guests.find((entry) => entry.guest.name?.toLowerCase() === needle) ??
        guests.find((entry) =>
          entry.guest.name?.toLowerCase().includes(needle),
        ) ??
        null
      );
    },
    guestFsInfo: async (ref) =>
      (
        await get<{ result?: ProxmoxGuestFs[] }>(
          `/nodes/${ref.node}/qemu/${ref.guest.vmid}/agent/get-fsinfo`,
        )
      ).result ?? [],
    getGuestStatus: (ref) =>
      get<ProxmoxGuestStatus>(
        `/nodes/${ref.node}/${ref.kind}/${ref.guest.vmid}/status/current`,
      ),
    clusterResources: () => get<ProxmoxResource[]>('/cluster/resources'),
    nodeStatus: (node) =>
      get<ProxmoxNodeStatus>(`/nodes/${encodeURIComponent(node)}/status`),
    nodeHistory: (node, timeframe) =>
      get<ProxmoxRrdPoint[]>(
        `/nodes/${encodeURIComponent(node)}/rrddata?timeframe=${timeframe}&cf=AVERAGE`,
      ),
    // skipsmart=1: a saúde vem depois do /disks/smart de cada disco, com os atributos.
    listDisks: (node) =>
      get<ProxmoxDisk[]>(
        `/nodes/${encodeURIComponent(node)}/disks/list?skipsmart=1`,
      ),
    diskSmart: (node, devpath) =>
      get<ProxmoxSmart>(
        `/nodes/${encodeURIComponent(node)}/disks/smart?disk=${encodeURIComponent(devpath)}`,
      ),
    listZfsPools: (node) =>
      get<ProxmoxZfsPool[]>(`/nodes/${encodeURIComponent(node)}/disks/zfs`),
  };
}
