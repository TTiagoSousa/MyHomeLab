import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import { ProxmoxConnection } from 'src/proxmox/proxmox.client';
import {
  listServers,
  listProxmoxGuests,
  getProxmoxGuestStatus,
  checkServiceStatus,
} from '../tools/serverStatus';
import {
  checkServiceMonitor,
  listNotifications,
  listServiceMonitors,
} from '../tools/serviceMonitorTools';
import { diskHealth } from '../tools/diskHealthTools';
import { listBackups, runBackup } from '../tools/backupTools';

const SERVER_SCHEMA = {
  type: 'string' as const,
  description:
    'Nome do servidor, como aparece em list_servers. Omite para usar todos.',
};

// As definições das ferramentas são fixas (o caching vive do prefixo igual); o que
// muda por utilizador — os servidores — só entra pelos handlers.
export function buildServerTools(
  servers: ProxmoxConnection[],
  context: AgentContext,
): AgentTool[] {
  const { isAdmin, userId } = context;

  return [
    {
      name: 'list_service_monitors',
      description:
        'Lista os serviços vigiados pelo utilizador: estado (online/em baixo), endereço, ' +
        'intervalo, última verificação, latência, erro, servidor e máquina associados.',
      inputSchema: { type: 'object', properties: {} },
      handler: () => listServiceMonitors(context.serviceMonitors, userId),
    },
    {
      name: 'check_service_monitor',
      description:
        'Testa agora um serviço vigiado, pelo nome, e devolve o resultado. Se mudar de ' +
        'estado, abre ou fecha o alerta como o botão Testar da app.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              'Nome (ou parte do nome) da app ligada, ex: "Forgejo".',
          },
        },
        required: ['name'],
      },
      handler: (input: { name: string }) =>
        checkServiceMonitor(context.serviceMonitors, userId, input.name),
    },
    {
      name: 'list_notifications',
      description:
        'Lista os alertas (notificações) do utilizador: serviços em baixo, máquinas que ' +
        'desapareceram e atualizações disponíveis. Por omissão só os ativos.',
      inputSchema: {
        type: 'object',
        properties: {
          include_resolved: {
            type: 'boolean',
            description:
              'Incluir também os alertas já resolvidos (histórico recente).',
          },
        },
      },
      handler: (input: { include_resolved?: boolean }) =>
        listNotifications(
          context.notifications,
          userId,
          Boolean(input?.include_resolved),
        ),
    },
    {
      name: 'list_backups',
      description:
        'Lista os destinos de backups (Nextcloud) e os backups automáticos das apps ligadas: ' +
        'app, destino e pasta, frequência, retenção e como correu o último.',
      inputSchema: { type: 'object', properties: {} },
      handler: () => listBackups(context.backups, userId),
    },
    {
      name: 'run_backup',
      description:
        'Faz agora o backup de uma app ligada (ex: o Forgejo) para o destino configurado e ' +
        'aplica a retenção. Devolve o ficheiro gravado ou o erro.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              'Nome (ou parte do nome) da app ligada, ex: "Forgejo".',
          },
        },
        required: ['name'],
      },
      handler: (input: { name: string }) =>
        runBackup(context.backups, userId, input.name),
    },
    {
      name: 'disk_health',
      description:
        'Saúde dos discos físicos de todos os servidores Proxmox do utilizador: SMART, vida ' +
        'restante dos SSD/NVMe, temperatura, setores realocados e pendentes, pools ZFS, e o ' +
        'que precisa de atenção. Lê na hora.',
      inputSchema: { type: 'object', properties: {} },
      handler: () => diskHealth(context.diskHealth, userId),
    },
    {
      name: 'list_servers',
      description:
        'Lista os servidores Proxmox que o utilizador configurou, com nome, endereço e id (o id serve para ligar documentos ao servidor: type SERVER).',
      inputSchema: { type: 'object', properties: {} },
      handler: () => Promise.resolve(listServers(servers)),
    },
    {
      name: 'list_proxmox_guests',
      description:
        'Lista as VMs e containers (LXC) de um servidor Proxmox, ou de todos, com o ' +
        'estado atual (running/stopped) e o nó.',
      inputSchema: {
        type: 'object',
        properties: { server: SERVER_SCHEMA },
      },
      handler: async (input: { server?: string }) =>
        listProxmoxGuests(servers, input?.server),
    },
    {
      name: 'get_guest_status',
      description:
        'Verifica o estado e uso de recursos (memória, CPU) de uma VM ou container pelo ' +
        'nome. Procura em todos os servidores, a não ser que digas qual.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              "Nome (ou parte do nome) da VM/container, ex: 'immich'.",
          },
          server: SERVER_SCHEMA,
        },
        required: ['name'],
      },
      handler: async (input: { name: string; server?: string }) =>
        getProxmoxGuestStatus(servers, input.name, input.server),
    },
    {
      name: 'check_service_status',
      description: 'Verifica se um serviço web num URL está a responder.',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'O URL a testar, ex: https://nextcloud.exemplo.com',
          },
        },
        required: ['url'],
      },
      // Testar um URL faz o servidor do MyHomeLab pedir o que lhe disserem dentro da
      // rede de casa — fica para os administradores.
      handler: async (input: { url: string }) =>
        isAdmin
          ? checkServiceStatus(input.url)
          : 'Só um administrador pode testar URLs. Diz isso ao utilizador.',
    },
  ];
}
