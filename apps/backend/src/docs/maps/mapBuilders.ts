import {
  count,
  dateTime,
  day,
  frequencyText,
  gigabytes,
  labelTree,
  section,
  table,
  withNotes,
} from './mapContent';

export interface ServerFacts {
  name: string;
  host: string;
  port: number;
  sshEnabled: boolean;
  version?: string;
  nodes: {
    node: string;
    status?: string;
    maxcpu?: number;
    maxmem?: number;
    uptime?: number;
  }[];
  guests: {
    vmid: number;
    kind: string;
    name: string;
    node: string;
    status?: string;
    maxcpu?: number;
    maxmem?: number;
    maxdisk?: number;
    template: boolean;
  }[];
  storages: {
    storage: string;
    node?: string;
    type?: string;
    used?: number;
    total?: number;
    shared: boolean;
  }[];
  apps: { label: string; vmid: number | null }[];
  monitors: string[];
  /** Quando o Proxmox não respondeu: o mapa diz o que se sabe sem ele. */
  error?: string;
}

const uptimeText = (seconds?: number) => {
  if (!seconds) return null;
  const days = Math.floor(seconds / 86400);
  return days >= 1 ? `${days} dias` : `${Math.round(seconds / 3600)} h`;
};

export function serverMap(
  title: string,
  facts: ServerFacts,
  existing?: string | null,
) {
  const appsByGuest = new Map<number, string[]>();
  for (const app of facts.apps) {
    if (app.vmid == null) continue;
    appsByGuest.set(app.vmid, [
      ...(appsByGuest.get(app.vmid) ?? []),
      app.label,
    ]);
  }
  const guests = facts.guests
    .filter((guest) => !guest.template)
    .sort((a, b) => a.vmid - b.vmid);

  return withNotes(
    title,
    [
      section('O servidor', [
        `- **Proxmox VE** em \`${facts.host}:${facts.port}\`${facts.version ? ` · versão ${facts.version}` : ''}`,
        `- **Comandos por SSH:** ${facts.sshEnabled ? 'ligados' : 'desligados (só leituras pela API)'}`,
        facts.error &&
          `- ⚠ Não consegui ler o Proxmox nesta passagem (${facts.error}): as máquinas abaixo podem estar desatualizadas ou em falta.`,
      ]),
      section(
        'Nós',
        facts.nodes.map(
          (node) =>
            `- **${node.node}**${node.status ? ` (${node.status})` : ''} · ${node.maxcpu ?? '?'} CPU · ${gigabytes(node.maxmem)} de memória${uptimeText(node.uptime) ? ` · ligado há ${uptimeText(node.uptime)}` : ''}`,
        ),
      ),
      guests.length
        ? [
            '## Máquinas',
            '',
            table(
              [
                'ID',
                'Tipo',
                'Nome',
                'Nó',
                'Estado',
                'CPU',
                'Memória',
                'Disco',
                'Apps ligadas',
              ],
              guests.map((guest) => [
                String(guest.vmid),
                guest.kind === 'qemu' ? 'VM' : 'CT',
                guest.name || '—',
                guest.node,
                guest.status ?? '—',
                String(guest.maxcpu ?? '—'),
                gigabytes(guest.maxmem),
                gigabytes(guest.maxdisk),
                appsByGuest.get(guest.vmid)?.join(', ') ?? '',
              ]),
            ),
          ].join('\n')
        : '',
      facts.storages.length
        ? [
            '## Armazenamento',
            '',
            table(
              ['Nome', 'Nó', 'Tipo', 'Usado', 'Total'],
              facts.storages.map((storage) => [
                storage.storage,
                storage.shared ? 'partilhado' : (storage.node ?? '—'),
                storage.type ?? '—',
                gigabytes(storage.used),
                gigabytes(storage.total),
              ]),
            ),
          ].join('\n')
        : '',
      section(
        'Apps ligadas neste servidor',
        facts.apps.map(
          (app) =>
            `- ${app.label}${app.vmid != null ? ` — na máquina ${app.vmid}` : ''}`,
        ),
      ),
      section(
        'Serviços vigiados',
        facts.monitors.map((monitor) => `- ${monitor}`),
      ),
    ],
    existing,
  );
}

export interface GmailFacts {
  rules: number;
  activeRules: number;
  frequency: string | null;
  lastRunAt: Date | null;
  proposalFrequency: string | null;
  labels: string[];
  inboxTotal?: number;
  inboxUnread?: number;
  mailboxTotal?: number;
  error?: string;
}

export interface AppFacts {
  app: string;
  baseUrl: string | null;
  username: string | null;
  emailAddress: string | null;
  isAdmin: boolean;
  version: string | null;
  latestVersion: string | null;
  checkedAt: Date | null;
  runsOn: string | null;
  since: Date;
  gmail?: GmailFacts;
}

function gmailSections(gmail: GmailFacts): string[] {
  return [
    section('Regras', [
      `- **${count(gmail.rules)} regras** (${count(gmail.activeRules)} ativas), correm ${frequencyText(gmail.frequency)}${gmail.lastRunAt ? ` · última execução ${dateTime(gmail.lastRunAt)}` : ''}`,
      `- **Propostas de regras pela IA:** ${frequencyText(gmail.proposalFrequency)}`,
      '- As regras uma a uma estão no documento "Emails – as regras do Gmail".',
    ]),
    gmail.labels.length
      ? [
          '## Marcadores',
          '',
          `${count(gmail.labels.length)} marcadores teus, por baixo de cada um de topo:`,
          '',
          ...labelTree(gmail.labels),
        ].join('\n')
      : '',
    section('Caixa', [
      gmail.inboxTotal !== undefined &&
        `- **${count(gmail.inboxTotal)} conversas na caixa de entrada** (${count(gmail.inboxUnread ?? 0)} por ler)`,
      gmail.mailboxTotal !== undefined &&
        `- ${count(gmail.mailboxTotal)} conversas no total`,
      gmail.error &&
        `- ⚠ Não consegui ler o Gmail nesta passagem (${gmail.error}).`,
    ]),
  ];
}

export function appMap(
  title: string,
  facts: AppFacts,
  existing?: string | null,
) {
  const version = facts.version
    ? `${facts.version}${facts.latestVersion && facts.latestVersion !== facts.version ? ` (há a ${facts.latestVersion})` : ''}${facts.checkedAt ? ` · vista em ${day(facts.checkedAt)}` : ''}`
    : null;

  return withNotes(
    title,
    [
      section('A app', [
        `- **App:** ${facts.app}`,
        facts.emailAddress && `- **Conta:** ${facts.emailAddress}`,
        facts.baseUrl && `- **Endereço:** ${facts.baseUrl}`,
        facts.username &&
          `- **Utilizador ligado:** ${facts.username}${facts.isAdmin ? ' (administrador)' : ''}`,
        version && `- **Versão:** ${version}`,
        facts.runsOn && `- **Onde corre:** ${facts.runsOn}`,
        `- **Ligada desde:** ${day(facts.since)}`,
      ]),
      ...(facts.gmail ? gmailSections(facts.gmail) : []),
    ],
    existing,
  );
}
