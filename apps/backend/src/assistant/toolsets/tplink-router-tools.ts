import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import {
  TPLINK_BANDS,
  TPLINK_NETWORKS,
  TplinkBand,
  TplinkDevice,
  TplinkNetwork,
  TplinkOfflineError,
  TplinkLease,
  TplinkMeshNode,
  TplinkPort,
  TplinkReservation,
  TplinkRouterApi,
  TplinkStatus,
  withTplinkRouter,
} from 'src/tplink-router/tplink-router.client';

const fold = (text: string) => text.trim().toLowerCase();

const ACCOUNT = {
  type: 'string' as const,
  description:
    'O router ou o extensor (nome ou endereço). Omite quando só há um ligado.',
};

const NETWORK = {
  type: 'string' as const,
  enum: TPLINK_NETWORKS,
  description: 'host = a rede principal, guest = convidados, iot = a rede IoT.',
};

const BAND = { type: 'string' as const, enum: TPLINK_BANDS };

const MAC = {
  type: 'string' as const,
  description:
    'O MAC (qualquer formato) ou o nome do dispositivo como aparece no tplink_router_clients.',
};

const CONNECTION_NAME: Record<string, string> = {
  wired: 'cabo',
  host_mlo: 'Wi-Fi MLO',
  unknown: '?',
};

const connectionName = (connection: string) =>
  CONNECTION_NAME[connection] ??
  connection
    .replace('host_', 'Wi-Fi ')
    .replace('guest_', 'convidados ')
    .replace('iot_', 'IoT ')
    .replace(/(\d)g$/, '$1G');

const onOff = (value: boolean | null | undefined) =>
  value === null || value === undefined ? '—' : value ? 'ligada' : 'desligada';

const duration = (seconds: number | null) => {
  if (seconds === null) return '—';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days
    ? `${days} d ${hours} h`
    : hours
      ? `${hours} h ${minutes} min`
      : `${minutes} min`;
};

const speed = (value: number | null) =>
  value === null
    ? ''
    : value >= 1024
      ? `${(value / 1024).toFixed(1)} MB/s`
      : `${value} KB/s`;

const deviceLine = (device: TplinkDevice) =>
  `- ${device.hostname || '(sem nome)'} · ${device.ip || 'sem IP'} · ${device.mac} · ${connectionName(device.connection)}${device.viaSatellite ? ` · no extensor ${device.apName ?? ''}` : ''}${device.signal !== null ? ` · sinal ${device.signal}` : ''}${device.downSpeed !== null ? ` · ↓${speed(device.downSpeed)} ↑${speed(device.upSpeed)}` : ''}${device.onlineSeconds ? ` · ligado há ${duration(device.onlineSeconds)}` : ''}`;

const wifiSummary = (status: TplinkStatus) =>
  TPLINK_NETWORKS.flatMap((network) =>
    TPLINK_BANDS.filter((band) => status.wifi[network][band] !== null).map(
      (band) =>
        `${network} ${band.toUpperCase()}: ${onOff(status.wifi[network][band])}`,
    ),
  ).join(' · ');

/** O router a usar: o único, ou o que bate com o nome ou o endereço. */
export async function tplinkRouterTarget(
  context: AgentContext,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await context.connectedAccountRepository.findAllByUser(
      context.userId,
      ConnectionProvider.TPLINK_ROUTER,
    )
  ).filter(
    (account) => account.isActive && account.baseUrl && account.appPassword,
  );
  if (!accounts.length) {
    return 'Não há nenhum router TP-Link ligado. Liga-o em Apps ligadas → TP-Link Archer.';
  }
  const label = (account: ConnectedAccount) =>
    `${account.displayName ?? 'Router'} (${account.baseUrl})`;
  const matches = wanted?.trim()
    ? accounts.filter((account) => fold(label(account)).includes(fold(wanted)))
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o router: ${accounts.map(label).join(', ')}.`;
  }
  return matches[0];
}

/** Um dispositivo pelo MAC ou pelo nome (dos ligados agora). */
async function deviceMac(router: TplinkRouterApi, wanted: string) {
  const hex = wanted.replace(/[^0-9a-f]/gi, '');
  if (hex.length === 12) return { mac: wanted, name: '' };
  const { devices } = await router.status();
  const matches = devices.filter((device) =>
    fold(device.hostname).includes(fold(wanted)),
  );
  if (matches.length !== 1) {
    throw new Error(
      matches.length
        ? `há vários «${wanted}»: ${matches.map((device) => `${device.hostname} ${device.mac}`).join('; ')}`
        : `não há nenhum dispositivo ligado com o nome «${wanted}» (diz o MAC)`,
    );
  }
  return { mac: matches[0].mac, name: matches[0].hostname };
}

export function buildTplinkRouterTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(work: (router: TplinkRouterApi, input: T) => Promise<string>) =>
    async (input: T & { account?: string }) => {
      const account = await tplinkRouterTarget(context, input.account);
      if (typeof account === 'string') return account;
      try {
        return await withTplinkRouter(account, (router) => work(router, input));
      } catch (error) {
        // Desligado não é um erro: diz-se o estado e quando volta a tentar.
        if (error instanceof TplinkOfflineError) return error.message;
        // Num extensor, o que é do router principal diz-se como informação.
        if (
          error instanceof Error &&
          error.message.startsWith('isto é um extensor')
        ) {
          return `I${error.message.slice(1)}.`;
        }
        return `Falhou: ${error instanceof Error ? error.message : String(error)}`;
      }
    };

  return [
    {
      name: 'tplink_router_overview',
      description:
        'O router TP-Link (Archer) da casa, ou um extensor (RE): modelo e firmware, num extensor a ligação ao router principal (sinal e velocidade por banda, mesh), a Internet (IP, tipo de ligação, há quanto tempo está ligada), CPU e memória, que redes Wi-Fi estão ligadas (principal, convidados, IoT por banda), quantos dispositivos por tipo, as portas físicas e os nós mesh. Se disser que está desligado do MyHomeLab, não é um erro: volta a ligar sozinho de 5 em 5 minutos.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (router) => {
        const firmware = await router.firmware();
        const status = await router.status(true);
        const ports = await router.ports().catch((): TplinkPort[] => []);
        const mesh = await router.mesh().catch((): TplinkMeshNode[] => []);
        const repeater = await router.repeater().catch(() => null);
        const backhaul = (
          name: string,
          band: NonNullable<typeof repeater>['band2g'],
        ) =>
          `${name}: ${band.connected ? `ligado a «${band.ssid ?? '?'}»${band.rssi !== null ? `, sinal ${band.rssi}` : ''}${band.rxRateMbps !== null ? `, ${band.rxRateMbps}/${band.txRateMbps ?? '?'} Mbps` : ''}` : (band.connection ?? 'desligado')}`;
        return [
          `${firmware.model || 'Router'}${router.kind === 'extender' ? ' (extensor)' : ''} (hardware ${firmware.hardwareVersion || '?'}) · firmware ${firmware.firmwareVersion || '?'}`,
          repeater
            ? `Ligação ao router principal — ${repeater.wired.connected ? `por cabo (${repeater.wired.ip ?? '?'})` : `${backhaul('2,4 GHz', repeater.band2g)} · ${backhaul('5 GHz', repeater.band5g)}`}${repeater.internetStatus ? ` · Internet ${repeater.internetStatus}` : ''}${repeater.meshEnabled !== null ? ` · mesh ${repeater.meshEnabled ? 'ligado' : 'desligado'}${repeater.meshSync ? ` (${repeater.meshSync})` : ''}` : ''}`
            : '',
          router.kind === 'extender'
            ? ''
            : `Internet: ${status.wanIp ?? 'sem IP'}${status.wanConnType ? ` (${status.wanConnType})` : ''} · gateway ${status.wanGateway ?? '—'} · ligada há ${duration(status.wanUptimeSeconds)}${status.wanIpv6Enabled ? ' · IPv6 ligado' : ''}`,
          `Rede local: ${status.lanIp ?? '—'} · DHCP ${onOff(status.lanDhcpEnabled)}`,
          `CPU ${status.cpuUsage ?? '—'}% · memória ${status.memUsage ?? '—'}%`,
          `Wi-Fi: ${wifiSummary(status) || '—'}`,
          `Dispositivos: ${status.wiredTotal} por cabo, ${status.wifiTotal} no Wi-Fi, ${status.guestTotal} convidados${status.iotTotal ? `, ${status.iotTotal} IoT` : ''}`,
          ports.length
            ? `Portas: ${ports.map((port) => `${port.name} ${port.linkUp ? `${port.speedMbps ?? '?'} Mbps${port.duplex ? ` ${port.duplex}` : ''}` : port.linkUp === false ? 'sem cabo' : '?'}`).join(' · ')}`
            : '',
          mesh.length
            ? `Mesh: ${mesh.map((node) => `${node.name ?? node.mac} (${node.role ?? '?'}, ${node.status ?? '?'}, ${node.clients ?? 0} clientes)`).join(' · ')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n');
      }),
    },
    {
      name: 'tplink_router_clients',
      description:
        'Os dispositivos ligados ao router agora: nome, IP, MAC, como estão ligados (cabo, Wi-Fi 2,4/5/6 GHz, MLO, convidados, IoT), sinal, velocidade e há quanto tempo. query filtra pelo nome, IP ou MAC.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          query: { type: 'string' },
          type: {
            type: 'string',
            enum: ['wired', 'wifi', 'guest', 'iot'],
            description: 'Só os de um tipo.',
          },
        },
      },
      handler: run(async (router, input: { query?: string; type?: string }) => {
        const { devices } = await router.status(true);
        const wanted = input.query ? fold(input.query) : '';
        const ofType = (device: TplinkDevice) =>
          !input.type ||
          (input.type === 'wired' && device.connection === 'wired') ||
          (input.type === 'wifi' && device.connection.startsWith('host')) ||
          (input.type === 'guest' && device.connection.startsWith('guest')) ||
          (input.type === 'iot' && device.connection.startsWith('iot'));
        const list = devices
          .filter(ofType)
          .filter(
            (device) =>
              !wanted ||
              [device.hostname, device.ip, device.mac].some((value) =>
                fold(value).includes(wanted),
              ),
          )
          .sort((a, b) => a.hostname.localeCompare(b.hostname));
        return list.length
          ? `${list.length} dispositivo(s):\n${list.map(deviceLine).join('\n')}`
          : 'Nenhum dispositivo com esse filtro.';
      }),
    },
    {
      name: 'tplink_router_wifi',
      description:
        'As redes Wi-Fi do router (principal, convidados, IoT, por banda): ligada ou não, nome (SSID), escondida, segurança e canal. Não mostra as palavras-passe.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (router) => {
        const status = await router.status();
        const lines: string[] = [];
        for (const network of TPLINK_NETWORKS) {
          for (const band of TPLINK_BANDS) {
            if (status.wifi[network][band] === null) continue;
            const wifi = await router.wifi(network, band).catch(() => null);
            if (!wifi) continue;
            lines.push(
              `- ${network} ${band.toUpperCase()}: ${onOff(wifi.enabled)} · «${wifi.ssid ?? '?'}»${wifi.hidden ? ' (escondida)' : ''} · ${wifi.encryption ?? '?'} · canal ${wifi.channel ?? 'auto'}`,
            );
          }
        }
        const mlo = TPLINK_BANDS.filter((band) => status.mlo[band] !== null);
        if (mlo.length) {
          lines.push(
            `- MLO: ${mlo.map((band) => `${band.toUpperCase()} ${onOff(status.mlo[band])}`).join(', ')}`,
          );
        }
        return lines.length
          ? lines.join('\n')
          : 'O router não disse que redes tem.';
      }),
    },
    {
      name: 'tplink_router_dhcp',
      description:
        'O DHCP do router: os IPs dados agora (com o tempo que falta) e as reservas de IP (IP fixo por MAC).',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (router) => {
        const [leases, reservations] = await Promise.all([
          router.leases().catch((): TplinkLease[] => []),
          router.reservations().catch((): TplinkReservation[] => []),
        ]);
        return [
          `Reservas (${reservations.length}):`,
          ...reservations.map(
            (item) =>
              `- ${item.ip} → ${item.mac} ${item.name}${item.enabled === false ? ' (desligada)' : ''}`,
          ),
          `IPs dados (${leases.length}):`,
          ...leases.map(
            (item) =>
              `- ${item.ip} · ${item.name || '(sem nome)'} · ${item.mac} · ${item.leaseTime}`,
          ),
        ].join('\n');
      }),
    },
    {
      name: 'tplink_router_port_forwards',
      description:
        'O reencaminhamento de portas (servidores virtuais) do router.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (router) => {
        const rules = await router.portForwards();
        return rules.length
          ? rules
              .map(
                (rule) =>
                  `- «${rule.name}»: ${rule.protocol} ${rule.externalPort} → ${rule.ip}:${rule.internalPort}${rule.enabled === false ? ' (desligada)' : ''}`,
              )
              .join('\n')
          : 'Não há reencaminhamentos de portas.';
      }),
    },
    {
      name: 'tplink_router_access',
      description:
        'O controlo de acesso do router: se está ligado, o modo (lista negra ou branca) e os dispositivos bloqueados.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (router) => {
        const [control, blocked] = await Promise.all([
          router.accessControl(),
          router.blocked(),
        ]);
        return [
          `Controlo de acesso ${control.enabled ? 'ligado' : 'desligado'} · modo ${control.mode === 'whitelist' ? 'lista branca' : 'lista negra'}`,
          blocked.length
            ? `Bloqueados (${blocked.length}):\n${blocked.map((item) => `- ${item.name || '(sem nome)'} ${item.mac}`).join('\n')}`
            : 'Nenhum dispositivo na lista negra.',
          !control.enabled && blocked.length
            ? 'Atenção: com o controlo de acesso desligado, a lista negra não tem efeito.'
            : '',
        ]
          .filter(Boolean)
          .join('\n');
      }),
    },
    {
      name: 'tplink_router_wifi_set',
      description:
        'Liga ou desliga uma rede Wi-Fi do router (ex.: a de convidados 5G), e muda o nome (SSID) ou se fica escondida. Só quando ele pedir. Desligar a rede principal tira o Wi-Fi a toda a casa (e talvez a ti): confirma com ele antes.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          network: NETWORK,
          band: BAND,
          enabled: { type: 'boolean' },
          ssid: { type: 'string' },
          hidden: { type: 'boolean' },
        },
        required: ['network', 'band'],
      },
      handler: run(
        async (
          router,
          input: {
            network: TplinkNetwork;
            band: TplinkBand;
            enabled?: boolean;
            ssid?: string;
            hidden?: boolean;
          },
        ) => {
          if (
            input.enabled === undefined &&
            input.ssid === undefined &&
            input.hidden === undefined
          ) {
            return 'Diz o que mudar: enabled, ssid ou hidden.';
          }
          await router.setWifi(input.network, input.band, {
            enabled: input.enabled,
            ssid: input.ssid,
            hidden: input.hidden,
          });
          const wifi = await router
            .wifi(input.network, input.band)
            .catch(() => null);
          return wifi
            ? `Feito. ${input.network} ${input.band.toUpperCase()}: ${onOff(wifi.enabled)} · «${wifi.ssid ?? '?'}»${wifi.hidden ? ' (escondida)' : ''}.`
            : 'Feito (não consegui reler a rede para confirmar).';
        },
      ),
    },
    {
      name: 'tplink_router_block',
      description:
        'Bloqueia (block) ou desbloqueia (unblock) um dispositivo: põe-no ou tira-o da lista negra do controlo de acesso. Só quando ele pedir. Bloquear só tem efeito com o controlo de acesso ligado em lista negra (tplink_router_access_control).',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          action: { type: 'string', enum: ['block', 'unblock'] },
          device: MAC,
          name: {
            type: 'string',
            description: 'O nome a guardar na lista (block).',
          },
        },
        required: ['action', 'device'],
      },
      handler: run(
        async (
          router,
          input: { action: 'block' | 'unblock'; device: string; name?: string },
        ) => {
          const { mac, name } = await deviceMac(router, input.device);
          if (input.action === 'block')
            await router.block(mac, input.name ?? name);
          else await router.unblock(mac);
          const control = await router.accessControl().catch(() => null);
          return `${input.action === 'block' ? 'Bloqueado' : 'Desbloqueado'}: ${name || mac}.${input.action === 'block' && control && (!control.enabled || control.mode !== 'blacklist') ? ' Atenção: o controlo de acesso não está ligado em lista negra, por isso ainda não tem efeito.' : ''}`;
        },
      ),
    },
    {
      name: 'tplink_router_access_control',
      description:
        'Liga ou desliga o controlo de acesso do router e escolhe o modo (blacklist: bloqueia os da lista; whitelist: só deixam entrar os da lista branca). Só quando ele pedir; a lista branca pode tirar a rede a todos os outros — confirma com ele antes.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          enabled: { type: 'boolean' },
          mode: { type: 'string', enum: ['blacklist', 'whitelist'] },
        },
      },
      handler: run(
        async (
          router,
          input: { enabled?: boolean; mode?: 'blacklist' | 'whitelist' },
        ) => {
          if (input.enabled === undefined && !input.mode)
            return 'Diz enabled ou mode.';
          await router.setAccessControl(input);
          const control = await router.accessControl();
          return `Controlo de acesso ${control.enabled ? 'ligado' : 'desligado'} · ${control.mode === 'whitelist' ? 'lista branca' : 'lista negra'}.`;
        },
      ),
    },
    {
      name: 'tplink_router_reservation',
      description:
        'Reserva um IP fixo para um dispositivo (add: device + ip + name) ou apaga a reserva (delete: device). Só quando ele pedir. Recusa um MAC ou IP já reservado.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          action: { type: 'string', enum: ['add', 'delete'] },
          device: MAC,
          ip: { type: 'string' },
          name: { type: 'string' },
        },
        required: ['action', 'device'],
      },
      handler: run(
        async (
          router,
          input: {
            action: 'add' | 'delete';
            device: string;
            ip?: string;
            name?: string;
          },
        ) => {
          const { mac, name } = await deviceMac(router, input.device);
          if (input.action === 'delete') {
            await router.deleteReservation(mac);
            return `Reserva de ${name || mac} apagada.`;
          }
          if (!input.ip) return 'Falta o IP (ip).';
          await router.addReservation(mac, input.ip, input.name ?? name);
          return `Reservado ${input.ip} para ${name || mac}. Vale na próxima vez que o dispositivo pedir IP (ou depois de se ligar outra vez).`;
        },
      ),
    },
    {
      name: 'tplink_router_port_forward',
      description:
        'Cria (add: name, ip, external_port — uma porta ou "8000-8100" —, internal_port, protocol TCP/UDP/ALL) ou apaga (delete: name) um reencaminhamento de portas. Só quando ele pedir: abrir uma porta põe esse serviço na Internet — confirma com ele antes.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          action: { type: 'string', enum: ['add', 'delete'] },
          name: { type: 'string' },
          ip: { type: 'string' },
          external_port: { type: 'string' },
          internal_port: { type: 'string' },
          protocol: { type: 'string', enum: ['TCP', 'UDP', 'ALL'] },
        },
        required: ['action', 'name'],
      },
      handler: run(
        async (
          router,
          input: {
            action: 'add' | 'delete';
            name: string;
            ip?: string;
            external_port?: string;
            internal_port?: string;
            protocol?: 'TCP' | 'UDP' | 'ALL';
          },
        ) => {
          if (input.action === 'delete') {
            await router.deletePortForward(input.name);
            return `Regra «${input.name}» apagada.`;
          }
          if (!input.ip || !input.external_port) {
            return 'Falta o ip e a external_port.';
          }
          await router.addPortForward({
            name: input.name,
            ip: input.ip,
            externalPort: input.external_port,
            internalPort:
              input.internal_port ?? input.external_port.split('-')[0],
            protocol: input.protocol ?? 'TCP',
          });
          return `Regra «${input.name}» criada: ${input.protocol ?? 'TCP'} ${input.external_port} → ${input.ip}:${input.internal_port ?? input.external_port.split('-')[0]}.`;
        },
      ),
    },
    {
      name: 'tplink_router_wan_renew',
      description:
        'Pede um IP novo à Internet (renova o DHCP da ligação). Só quando ele pedir; só serve se a Internet chegar por DHCP. A ligação cai uns segundos.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (router) => {
        await router.renewWan(true);
        return 'Pedi um IP novo à Internet. Vê daqui a uns segundos com tplink_router_overview.';
      }),
    },
    {
      name: 'tplink_router_reboot',
      description:
        'Reinicia o router: a casa fica sem rede nem Internet uns 2 minutos. Só quando ele pedir, e confirma com ele antes. Depois o MyHomeLab volta a ligar sozinho.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (router) => {
        await router.reboot();
        return 'O router está a reiniciar (uns 2 minutos sem rede). O MyHomeLab volta a ligar sozinho.';
      }),
    },
  ];
}
