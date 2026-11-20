import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import {
  createGiteaMirrorClient,
  GiteaMirrorClient,
  GiteaMirrorJob,
  GiteaMirrorOrganization,
  GiteaMirrorRepository,
  giteaMirrorHealth,
} from 'src/gitea-mirror/gitea-mirror.client';

const fold = (text: string) => text.trim().toLowerCase();

const ACCOUNT = {
  type: 'string' as const,
  description: 'O Gitea Mirror (nome ou endereço). Omite quando só há um.',
};

const STATUSES = [
  'imported',
  'mirroring',
  'mirrored',
  'failed',
  'syncing',
  'synced',
  'skipped',
  'ignored',
  'pending-approval',
  'archived',
];

const when = (iso?: string | null) =>
  iso ? iso.slice(0, 16).replace('T', ' ') : 'nunca';

/** O Gitea Mirror a usar: o único, ou o que bate com o nome ou o endereço. */
export async function giteaMirrorTarget(
  context: AgentContext,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await context.connectedAccountRepository.findAllByUser(
      context.userId,
      ConnectionProvider.GITEA_MIRROR,
    )
  ).filter(
    (account) => account.isActive && account.baseUrl && account.accessToken,
  );
  if (!accounts.length) {
    return 'Não há nenhum Gitea Mirror ligado. Liga-o em Apps ligadas → Gitea Mirror.';
  }
  const label = (account: ConnectedAccount) =>
    `${account.displayName ?? 'Gitea Mirror'} (${account.baseUrl})`;
  const matches = wanted?.trim()
    ? accounts.filter((account) => fold(label(account)).includes(fold(wanted)))
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o Gitea Mirror: ${accounts.map(label).join(', ')}.`;
  }
  return matches[0];
}

/** Os repositórios pelo nome ("dono/repo" ou só "repo", sem ambiguidade). */
export function pickRepositories(
  all: GiteaMirrorRepository[],
  names: string[],
): GiteaMirrorRepository[] {
  return names.map((name) => {
    const wanted = fold(name);
    const exact = all.find((item) => fold(item.fullName) === wanted);
    if (exact) return exact;
    const byName = all.filter((item) => fold(item.name) === wanted);
    if (byName.length === 1) return byName[0];
    throw new Error(
      byName.length
        ? `há vários «${name}»: ${byName.map((item) => item.fullName).join(', ')}`
        : `o Gitea Mirror não tem «${name}» (acrescenta-o com gitea_mirror_add)`,
    );
  });
}

const repoLine = (item: GiteaMirrorRepository) =>
  `- ${item.fullName} — ${item.status}${item.isPrivate ? ', privado' : ''}, último espelho ${when(item.lastMirrored)}${item.mirroredLocation ? ` → ${item.mirroredLocation}` : ''}${item.errorMessage ? ` — erro: ${item.errorMessage.slice(0, 200)}` : ''}`;

export function buildGiteaMirrorTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(
      work: (
        mirror: GiteaMirrorClient,
        input: T,
        account: ConnectedAccount,
      ) => Promise<string>,
    ) =>
    async (input: T & { account?: string }) => {
      const account = await giteaMirrorTarget(context, input.account);
      if (typeof account === 'string') return account;
      try {
        return await work(
          createGiteaMirrorClient(
            account.baseUrl ?? '',
            account.accessToken ?? '',
          ),
          input,
          account,
        );
      } catch (error) {
        return `Falhou: ${error instanceof Error ? error.message : String(error)}`;
      }
    };

  return [
    {
      name: 'gitea_mirror_overview',
      description:
        'O Gitea Mirror (espelha os repositórios do GitHub no Gitea/Forgejo): a saúde, a versão, quantos repositórios em cada estado, os que falharam (com o erro), as organizações e o limite de pedidos ao GitHub.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (mirror, _input, account) => {
        const [health, repositories, organizations, rate] = await Promise.all([
          giteaMirrorHealth(account.baseUrl ?? ''),
          mirror.repositories(),
          mirror.organizations().catch((): GiteaMirrorOrganization[] => []),
          mirror.rateLimit().catch(() => undefined),
        ]);
        const byStatus: Record<string, number> = {};
        for (const item of repositories)
          byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
        const failed = repositories.filter((item) => item.status === 'failed');
        return [
          `Gitea Mirror ${health.version ?? '?'} — ${health.status}${health.updateAvailable ? ` (há a ${health.latestVersion})` : ''}${health.database?.connected === false ? ', base de dados desligada' : ''}.`,
          `Repositórios: ${repositories.length} — ${
            Object.entries(byStatus)
              .map(([status, count]) => `${count} ${status}`)
              .join(', ') || 'nenhum'
          }.`,
          organizations.length
            ? `Organizações: ${organizations.map((org) => `${org.name} (${org.status})`).join(', ')}.`
            : '',
          rate?.limit
            ? `GitHub: ${rate.remaining ?? '?'} de ${rate.limit} pedidos livres${rate.reset ? `, renova ${when(rate.reset)}` : ''}.`
            : '',
          failed.length
            ? `Falharam:\n${failed.slice(0, 20).map(repoLine).join('\n')}`
            : 'Nenhum falhou.',
        ]
          .filter(Boolean)
          .join('\n');
      }),
    },
    {
      name: 'gitea_mirror_repos',
      description:
        'Os repositórios do Gitea Mirror com o estado, o último espelho, onde ficam no Gitea e o erro, se houver. Filtra por estado ou por texto no nome.',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: STATUSES },
          search: { type: 'string' },
          limit: { type: 'integer', description: 'Até 300 (omissão 100).' },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (
          mirror,
          input: { status?: string; search?: string; limit?: number },
        ) => {
          const found = (await mirror.repositories()).filter(
            (item) =>
              (!input.status || item.status === input.status) &&
              (!input.search ||
                fold(item.fullName).includes(fold(input.search))),
          );
          const limit = Math.min(input.limit ?? 100, 300);
          if (!found.length) return 'Nenhum repositório.';
          return [
            `${found.length} repositórios${found.length > limit ? ` (mostro ${limit})` : ''}:`,
            ...found.slice(0, limit).map(repoLine),
          ].join('\n');
        },
      ),
    },
    {
      name: 'gitea_mirror_activity',
      description:
        'O que o Gitea Mirror fez por último (espelhos, sincronizações, falhas), o mais recente primeiro. Filtra por repositório.',
      inputSchema: {
        type: 'object',
        properties: {
          repository: { type: 'string' },
          limit: { type: 'integer', description: 'Até 100 (omissão 25).' },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (mirror, input: { repository?: string; limit?: number }) => {
          const found = (await mirror.activities()).filter(
            (item) =>
              !input.repository ||
              fold(item.repositoryName ?? '').includes(fold(input.repository)),
          );
          if (!found.length) return 'Sem atividade.';
          return found
            .slice(0, Math.min(input.limit ?? 25, 100))
            .map(
              (item) =>
                `- ${when(item.timestamp)} ${item.repositoryName ?? item.organizationName ?? ''} — ${item.status}${item.inProgress ? ' (a correr)' : ''}: ${(item.message ?? '').slice(0, 200)}`,
            )
            .join('\n');
        },
      ),
    },
    {
      name: 'gitea_mirror_add',
      description:
        'Acrescenta ao Gitea Mirror um repositório do GitHub ("dono/repo") ou uma organização inteira (organization). Com mirror, espelha logo o repositório no Gitea; sem isso fica importado à espera. Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          repository: { type: 'string', description: '"dono/repo"' },
          organization: { type: 'string' },
          mirror: { type: 'boolean' },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (
          mirror,
          input: {
            repository?: string;
            organization?: string;
            mirror?: boolean;
          },
        ) => {
          if (input.organization?.trim()) {
            const { organization } = await mirror.addOrganization(
              input.organization.trim(),
            );
            return `Acrescentei a organização ${organization?.name ?? input.organization}. Os repositórios dela entram na próxima importação (gitea_mirror_import).`;
          }
          const [owner, repo] = (input.repository ?? '').trim().split('/');
          if (!owner || !repo) return 'Diz o repositório como "dono/repo".';
          const { repository } = await mirror.addRepository(owner, repo);
          if (!repository) return `Acrescentei ${owner}/${repo}.`;
          if (input.mirror) {
            await mirror.job('mirror-repo', [repository.id]);
            return `Acrescentei ${repository.fullName} e comecei o espelho no Gitea (vê o fim com gitea_mirror_activity).`;
          }
          return `Acrescentei ${repository.fullName} (fica importado; espelha com gitea_mirror_run).`;
        },
      ),
    },
    {
      name: 'gitea_mirror_run',
      description:
        'Corre um trabalho em repositórios do Gitea Mirror: mirror (espelhar pela primeira vez), sync (trazer as novidades do GitHub agora) ou retry (tentar outra vez os que falharam; sem repositories, todos os que falharam). Corre em segundo plano: vê o fim com gitea_mirror_activity.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['mirror', 'sync', 'retry'] },
          repositories: {
            type: 'array',
            items: { type: 'string' },
            description: '"dono/repo" ou o nome (até 50).',
          },
          account: ACCOUNT,
        },
        required: ['action'],
      },
      handler: run(
        async (
          mirror,
          input: {
            action: 'mirror' | 'sync' | 'retry';
            repositories?: string[];
          },
        ) => {
          const all = await mirror.repositories();
          const chosen = input.repositories?.length
            ? pickRepositories(all, input.repositories)
            : input.action === 'retry'
              ? all.filter((item) => item.status === 'failed')
              : [];
          if (!chosen.length)
            return input.action === 'retry'
              ? 'Não há repositórios falhados.'
              : 'Diz que repositórios.';
          if (chosen.length > 50) return 'São demasiados de uma vez (até 50).';
          const job: GiteaMirrorJob = {
            mirror: 'mirror-repo' as const,
            sync: 'sync-repo' as const,
            retry: 'retry-repo' as const,
          }[input.action];
          await mirror.job(
            job,
            chosen.map((item) => item.id),
          );
          return `Comecei ${input.action} em ${chosen.length}: ${chosen.map((item) => item.fullName).join(', ')}.`;
        },
      ),
    },
    {
      name: 'gitea_mirror_import',
      description:
        'Vai buscar às fontes (GitHub) os repositórios e organizações novos desde a última vez. Não espelha: os novos ficam importados.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (mirror) => {
        const result = await mirror.importAll();
        return `Importei ${result.newRepositories ?? 0} repositórios e ${result.newOrganizations ?? 0} organizações novas${result.failedSources?.length ? `; ${result.failedSources.length} fontes falharam` : ''}.`;
      }),
    },
  ];
}
