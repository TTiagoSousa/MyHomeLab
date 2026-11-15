import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import { GuestPowerAction } from 'src/proxmox/proxmox.client';
import {
  GuestTarget,
  backupNow,
  createSnapshot,
  deleteSnapshot,
  findGuestTarget,
  guestConfig,
  guestPower,
  listSnapshots,
  rollbackSnapshot,
  setResources,
} from '../tools/proxmoxControl';
import {
  commandHistory,
  inventory,
  runCommand,
} from '../tools/serverShellTools';

const SERVER = {
  type: 'string' as const,
  description: 'O servidor (nome). Omite quando só há um.',
};

const GUEST = {
  type: 'string' as const,
  description: 'A VM ou o CT: o número (vmid, ex.: "105") ou o nome.',
};

const SNAPSHOT = {
  type: 'string' as const,
  description: 'O nome do snapshot (como em pve_list_snapshots).',
};

/** Nível 1: mexer nas máquinas pela API do Proxmox (o que o painel deixa fazer). */
export function buildServerControlTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(work: (target: GuestTarget, input: T) => Promise<string>) =>
    async (input: T & { guest: string; server?: string }) => {
      const target = await findGuestTarget(
        await context.serverConnections.connectionsFor(context.userId),
        input.guest,
        input.server,
      );
      return typeof target === 'string' ? target : work(target, input);
    };

  return [
    {
      name: 'pve_guest_config',
      description:
        'A configuração de uma VM ou CT (CPU, RAM, discos, rede, arranque automático) e o estado.',
      inputSchema: {
        type: 'object',
        properties: { server: SERVER, guest: GUEST },
        required: ['guest'],
      },
      handler: run((target) => guestConfig(target)),
    },
    {
      name: 'pve_guest_power',
      description:
        'Liga, desliga, reinicia, suspende ou retoma uma VM ou CT. "shutdown" pede ao sistema para desligar; "stop" corta a energia (só se o shutdown não resultar).',
      inputSchema: {
        type: 'object',
        properties: {
          server: SERVER,
          guest: GUEST,
          action: {
            type: 'string',
            enum: ['start', 'shutdown', 'stop', 'reboot', 'suspend', 'resume'],
          },
        },
        required: ['guest', 'action'],
      },
      handler: run((target, input: { action: GuestPowerAction }) =>
        guestPower(target, input.action),
      ),
    },
    {
      name: 'pve_list_snapshots',
      description: 'Os snapshots de uma VM ou CT, com a data e a descrição.',
      inputSchema: {
        type: 'object',
        properties: { server: SERVER, guest: GUEST },
        required: ['guest'],
      },
      handler: run((target) => listSnapshots(target)),
    },
    {
      name: 'pve_create_snapshot',
      description:
        'Tira um snapshot de uma VM ou CT (para poder voltar atrás antes de uma mudança).',
      inputSchema: {
        type: 'object',
        properties: {
          server: SERVER,
          guest: GUEST,
          name: {
            type: 'string',
            description:
              'Letras, números, _ e -. Omite para um nome com a data.',
          },
          description: { type: 'string' },
        },
        required: ['guest'],
      },
      handler: run((target, input: { name?: string; description?: string }) =>
        createSnapshot(target, input.name, input.description),
      ),
    },
    {
      name: 'pve_rollback_snapshot',
      description:
        'Volta uma VM ou CT a um snapshot. Perde-se tudo o que mudou depois: só com pedido explícito do utilizador.',
      inputSchema: {
        type: 'object',
        properties: { server: SERVER, guest: GUEST, name: SNAPSHOT },
        required: ['guest', 'name'],
      },
      handler: run((target, input: { name: string }) =>
        rollbackSnapshot(target, input.name),
      ),
    },
    {
      name: 'pve_delete_snapshot',
      description: 'Apaga um snapshot de uma VM ou CT.',
      inputSchema: {
        type: 'object',
        properties: { server: SERVER, guest: GUEST, name: SNAPSHOT },
        required: ['guest', 'name'],
      },
      handler: run((target, input: { name: string }) =>
        deleteSnapshot(target, input.name),
      ),
    },
    {
      name: 'pve_backup_now',
      description:
        'Faz agora um backup (vzdump, modo snapshot, zstd) de uma VM ou CT para um storage de backups do Proxmox.',
      inputSchema: {
        type: 'object',
        properties: {
          server: SERVER,
          guest: GUEST,
          storage: {
            type: 'string',
            description:
              'O storage de destino. Omite para o primeiro que aceite backups.',
          },
        },
        required: ['guest'],
      },
      handler: run((target, input: { storage?: string }) =>
        backupNow(target, input.storage),
      ),
    },
    {
      name: 'pve_set_resources',
      description:
        'Muda os recursos de uma VM ou CT: núcleos, RAM, swap (só CT) e aumentar o disco (o Proxmox não deixa encolher).',
      inputSchema: {
        type: 'object',
        properties: {
          server: SERVER,
          guest: GUEST,
          cores: { type: 'integer' },
          memory_mb: { type: 'integer', description: 'A RAM total, em MB.' },
          swap_mb: { type: 'integer' },
          disk_grow_gb: {
            type: 'integer',
            description: 'Quantos GB acrescentar ao disco.',
          },
          disk: {
            type: 'string',
            description:
              'O disco a aumentar (rootfs, mp0, scsi0…). Omite para o principal.',
          },
        },
        required: ['guest'],
      },
      handler: run(setResources),
    },
  ];
}

/** Nível 2: comandos por SSH. Correm logo e ficam registados; as regras estão nos documentos. */
export function buildServerShellTools(context: AgentContext): AgentTool[] {
  const agentKey =
    context.team.find((agent) => agent.tools.includes('server_run_command'))
      ?.key ?? 'infra';

  return [
    {
      name: 'server_inventory',
      description:
        'O inventário completo do servidor num só passo (só leitura): host, discos, pools, storages, rede, serviços falhados, jobs de backup e, para cada CT e VM, a configuração e — nos CTs ligados — IPs, serviços, contentores Docker e portas. Começa por aqui para estudar o servidor.',
      inputSchema: { type: 'object', properties: { server: SERVER } },
      handler: (input: { server?: string }) =>
        inventory(context, input, agentKey),
    },
    {
      name: 'server_run_command',
      description:
        'Corre um comando no servidor por SSH (no host do Proxmox; num CT usa "pct exec <vmid> -- comando"). Corre logo e fica registado. O código não trava nada: antes de alterar, segue as regras dos documentos (do servidor, da app e "Quando corro sem ti"). Só contam como leitura os comandos simples de uma lista fechada (cat, ls, grep, systemctl status, docker ps…); os outros — incluindo interpretadores e scripts como python, node, bash -c ou sqlite3 — contam como alteração e, numa máquina, levam antes um snapshot dela.',
      inputSchema: {
        type: 'object',
        properties: {
          server: SERVER,
          command: {
            type: 'string',
            description:
              'O comando exato. Um por pedido; prefere comandos simples a scripts.',
          },
          reason: {
            type: 'string',
            description: 'Porque é preciso, numa frase — fica no registo.',
          },
        },
        required: ['command', 'reason'],
      },
      handler: (input: { server?: string; command: string; reason?: string }) =>
        runCommand(context, input, agentKey),
    },
    {
      name: 'server_command_history',
      description:
        'Os últimos comandos corridos num servidor, com o estado e o início da saída.',
      inputSchema: {
        type: 'object',
        properties: {
          server: SERVER,
          limit: {
            type: 'integer',
            description: 'Quantos (até 100, 15 por omissão).',
          },
        },
      },
      handler: (input: { server?: string; limit?: number }) =>
        commandHistory(context, input),
    },
  ];
}
