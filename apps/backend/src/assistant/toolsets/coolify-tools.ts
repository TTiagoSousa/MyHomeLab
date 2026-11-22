import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import {
  CoolifyClient,
  CoolifyDeployment,
  CoolifyKind,
  CoolifyResource,
  CoolifyServer,
  createCoolifyClient,
} from 'src/coolify/coolify.client';
import { lisbonStamp } from 'src/utils/lisbonTime';

const fold = (text: string) => text.trim().toLowerCase();

const ACCOUNT = {
  type: 'string' as const,
  description: 'O Coolify (nome ou endereço). Omite quando só há um.',
};

const KINDS: CoolifyKind[] = ['applications', 'services', 'databases'];

const KIND = {
  type: 'string' as const,
  enum: KINDS,
  description:
    'applications (apps), services (serviços de um template) ou databases. Omite e procuro nos três.',
};

const KIND_NAME: Record<CoolifyKind, string> = {
  applications: 'aplicação',
  services: 'serviço',
  databases: 'base de dados',
};

const when = (iso?: string | null) => lisbonStamp(iso);

const reachable = (server: CoolifyServer) =>
  server.is_reachable ?? server.settings?.is_reachable;

/** O Coolify a usar: o único, ou o que bate com o nome ou o endereço. */
export async function coolifyTarget(
  context: AgentContext,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await context.connectedAccountRepository.findAllByUser(
      context.userId,
      ConnectionProvider.COOLIFY,
    )
  ).filter(
    (account) => account.isActive && account.baseUrl && account.accessToken,
  );
  if (!accounts.length) {
    return 'Não há nenhum Coolify ligado. Liga-o em Apps ligadas → Coolify.';
  }
  const label = (account: ConnectedAccount) =>
    `${account.displayName ?? 'Coolify'} (${account.baseUrl})`;
  const matches = wanted?.trim()
    ? accounts.filter((account) => fold(label(account)).includes(fold(wanted)))
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o Coolify: ${accounts.map(label).join(', ')}.`;
  }
  return matches[0];
}

/** Um recurso pelo uuid ou pelo nome (exato, ou parte do nome sem ambiguidade). */
export function pickResource<T extends { uuid: string; name: string }>(
  all: T[],
  wanted: string,
): T {
  const text = fold(wanted);
  const exact =
    all.find((item) => item.uuid === wanted.trim()) ??
    all.find((item) => fold(item.name) === text);
  if (exact) return exact;
  const partial = all.filter((item) => fold(item.name).includes(text));
  if (partial.length === 1) return partial[0];
  throw new Error(
    partial.length
      ? `há vários «${wanted}»: ${partial.map((item) => item.name).join(', ')}`
      : `o Coolify não tem «${wanted}»`,
  );
}

/** Procura o recurso no tipo dado ou nos três; devolve-o com o tipo. */
async function findResource(
  coolify: CoolifyClient,
  wanted: string,
  kind?: CoolifyKind,
): Promise<{ kind: CoolifyKind; resource: CoolifyResource }> {
  const kinds = kind ? [kind] : KINDS;
  const lists = await Promise.all(
    kinds.map((item) => coolify.list(item).catch((): CoolifyResource[] => [])),
  );
  const all = kinds.flatMap((item, index) =>
    lists[index].map((resource) => ({ ...resource, kind: item })),
  );
  const found = pickResource(all, wanted);
  return { kind: found.kind, resource: found };
}

const resourceLine = (kind: CoolifyKind, item: CoolifyResource) =>
  `- ${item.name} [${KIND_NAME[kind]}${item.build_pack ? `, ${item.build_pack}` : item.database_type ? `, ${item.database_type}` : ''}] — ${item.status ?? '?'} — uuid ${item.uuid}${item.fqdn ? ` — ${item.fqdn}` : ''}${item.git_repository ? ` — ${item.git_repository}${item.git_branch ? `@${item.git_branch}` : ''}` : ''}`;

const healthy = (status?: string) =>
  !status ||
  /^running(:healthy|:unknown)?$/i.test(status) ||
  /^running$/i.test(status);

/** As linhas do log de um deploy (o Coolify guarda-as como JSON numa string). */
export function deploymentLogLines(logs?: string | null, max = 80): string[] {
  if (!logs) return [];
  try {
    const entries = JSON.parse(logs) as {
      output?: string;
      hidden?: boolean;
      type?: string;
    }[];
    return entries
      .filter((entry) => !entry.hidden && entry.output)
      .map(
        (entry) =>
          `${entry.type === 'stderr' ? '! ' : ''}${(entry.output ?? '').trim()}`,
      )
      .slice(-max);
  } catch {
    return logs.split('\n').slice(-max);
  }
}

export function buildCoolifyTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(
      work: (
        coolify: CoolifyClient,
        input: T,
        account: ConnectedAccount,
      ) => Promise<string>,
    ) =>
    async (input: T & { account?: string }) => {
      const account = await coolifyTarget(context, input.account);
      if (typeof account === 'string') return account;
      try {
        return await work(
          createCoolifyClient(account.baseUrl ?? '', account.accessToken ?? ''),
          input,
          account,
        );
      } catch (error) {
        return `Falhou: ${error instanceof Error ? error.message : String(error)}`;
      }
    };

  return [
    {
      name: 'coolify_overview',
      description:
        'O Coolify (onde correm apps, serviços e bases de dados em Docker): a versão, os servidores e se estão alcançáveis, os projetos com os ambientes, quantos recursos de cada tipo, os que não estão a correr bem e os deploys a correr agora.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (coolify) => {
        const [version, servers, projects, resources, running] =
          await Promise.all([
            coolify.version().catch(() => '?'),
            coolify.servers(),
            coolify.projects(),
            coolify.resources(),
            coolify.runningDeployments().catch((): CoolifyDeployment[] => []),
          ]);
        const byType: Record<string, number> = {};
        for (const item of resources) {
          const type = item.type ?? 'outro';
          byType[type] = (byType[type] ?? 0) + 1;
        }
        const sick = resources.filter((item) => !healthy(item.status));
        const detailed = await Promise.all(
          projects
            .slice(0, 30)
            .map((project) =>
              coolify.project(project.uuid).catch(() => project),
            ),
        );
        return [
          `Coolify ${version}.`,
          `Servidores (${servers.length}): ${
            servers
              .map(
                (server) =>
                  `${server.name}${server.ip ? ` ${server.ip}` : ''} — ${reachable(server) === false ? 'INALCANÇÁVEL' : reachable(server) ? 'alcançável' : '?'} (uuid ${server.uuid})`,
              )
              .join('; ') || 'nenhum'
          }.`,
          `Projetos (${projects.length}): ${
            detailed
              .map(
                (project) =>
                  `${project.name}${project.environments?.length ? ` [${project.environments.map((env) => env.name).join(', ')}]` : ''}`,
              )
              .join('; ') || 'nenhum'
          }.`,
          `Recursos (${resources.length}): ${
            Object.entries(byType)
              .map(([type, count]) => `${count} ${type}`)
              .join(', ') || 'nenhum'
          }.`,
          sick.length
            ? `Não estão bem (${sick.length}):\n${sick
                .slice(0, 30)
                .map(
                  (item) =>
                    `- ${item.name} [${item.type ?? '?'}] — ${item.status ?? '?'} — uuid ${item.uuid}`,
                )
                .join('\n')}`
            : 'Todos a correr bem.',
          running.length
            ? `Deploys a correr: ${running.map((item) => `${item.application_name ?? '?'} (${item.status}, ${item.deployment_uuid})`).join('; ')}.`
            : 'Nenhum deploy a correr.',
        ].join('\n');
      }),
    },
    {
      name: 'coolify_resources',
      description:
        'As aplicações, os serviços e as bases de dados do Coolify, com o estado, o uuid, os domínios e o repositório. Filtra por tipo, por texto no nome ou só os que não estão bem.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: KIND,
          search: { type: 'string' },
          unhealthy: {
            type: 'boolean',
            description: 'Só os que não estão a correr bem.',
          },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (
          coolify,
          input: { kind?: CoolifyKind; search?: string; unhealthy?: boolean },
        ) => {
          const kinds = input.kind ? [input.kind] : KINDS;
          const lists = await Promise.all(
            kinds.map((kind) => coolify.list(kind)),
          );
          const lines = kinds.flatMap((kind, index) =>
            lists[index]
              .filter(
                (item) =>
                  (!input.search ||
                    fold(item.name).includes(fold(input.search))) &&
                  (!input.unhealthy || !healthy(item.status)),
              )
              .map((item) => resourceLine(kind, item)),
          );
          return lines.length
            ? `${lines.length} recursos:\n${lines.slice(0, 200).join('\n')}`
            : 'Nenhum recurso.';
        },
      ),
    },
    {
      name: 'coolify_resource',
      description:
        'Os detalhes de uma aplicação, serviço ou base de dados do Coolify (pelo nome ou uuid): o estado, os domínios, o repositório e o ramo, a imagem, os limites, e nas aplicações os últimos deploys.',
      inputSchema: {
        type: 'object',
        properties: {
          resource: { type: 'string', description: 'O nome ou o uuid.' },
          kind: KIND,
          account: ACCOUNT,
        },
        required: ['resource'],
      },
      handler: run(
        async (coolify, input: { resource: string; kind?: CoolifyKind }) => {
          const { kind, resource } = await findResource(
            coolify,
            input.resource,
            input.kind,
          );
          const full = await coolify.get(kind, resource.uuid);
          const pick = (keys: string[]) =>
            keys
              .filter(
                (key) =>
                  full[key] !== undefined &&
                  full[key] !== null &&
                  full[key] !== '',
              )
              .map((key) => `${key}: ${String(full[key]).slice(0, 300)}`);
          const deployments =
            kind === 'applications'
              ? await coolify
                  .applicationDeployments(resource.uuid, 5)
                  .catch((): CoolifyDeployment[] => [])
              : [];
          return [
            `${full.name} [${KIND_NAME[kind]}] — ${full.status ?? '?'} — uuid ${full.uuid}`,
            ...pick([
              'description',
              'fqdn',
              'git_repository',
              'git_branch',
              'git_commit_sha',
              'build_pack',
              'docker_registry_image_name',
              'docker_registry_image_tag',
              'image',
              'database_type',
              'service_type',
              'ports_exposes',
              'ports_mappings',
              'public_port',
              'is_public',
              'health_check_enabled',
              'health_check_path',
              'limits_memory',
              'limits_cpus',
              'last_online_at',
              'updated_at',
            ]),
            deployments.length
              ? `Últimos deploys:\n${deployments
                  .map(
                    (item) =>
                      `- ${when(item.created_at)} ${item.status}${item.commit ? ` ${item.commit.slice(0, 7)}` : ''}${item.commit_message ? ` «${item.commit_message.split('\n')[0].slice(0, 80)}»` : ''} (${item.deployment_uuid})`,
                  )
                  .join('\n')}`
              : '',
          ]
            .filter(Boolean)
            .join('\n');
        },
      ),
    },
    {
      name: 'coolify_deploy',
      description:
        'Faz deploy no Coolify: de aplicações (constrói e põe a correr a versão nova) ou de serviços e bases de dados (reinicia com a configuração atual), pelo nome ou uuid, ou de tudo o que tem uma etiqueta (tag). Com force, constrói sem cache. Corre em segundo plano: vê o fim com coolify_deployments. Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          resources: {
            type: 'array',
            items: { type: 'string' },
            description: 'Nomes ou uuids (até 20).',
          },
          tag: { type: 'string' },
          force: { type: 'boolean' },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (
          coolify,
          input: { resources?: string[]; tag?: string; force?: boolean },
        ) => {
          if (!input.resources?.length && !input.tag?.trim())
            return 'Diz que recursos (ou a etiqueta).';
          if ((input.resources?.length ?? 0) > 20)
            return 'São demasiados de uma vez (até 20).';
          const chosen = input.resources?.length
            ? await Promise.all(
                input.resources.map((name) => findResource(coolify, name)),
              )
            : [];
          const result = await coolify.deploy({
            uuids: chosen.map((item) => item.resource.uuid),
            tag: input.tag?.trim() || undefined,
            force: input.force,
          });
          const lines = (result.deployments ?? []).map(
            (item) =>
              `- ${item.message ?? item.resource_uuid ?? ''}${item.deployment_uuid ? ` (deploy ${item.deployment_uuid})` : ''}`,
          );
          return lines.length
            ? `Comecei:\n${lines.join('\n')}`
            : (result.message ?? 'Pedido feito.');
        },
      ),
    },
    {
      name: 'coolify_control',
      description:
        'Arranca (start), para (stop) ou reinicia (restart) uma aplicação, serviço ou base de dados do Coolify, pelo nome ou uuid. Parar deixa a app em baixo até alguém a arrancar. Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          resource: { type: 'string', description: 'O nome ou o uuid.' },
          action: { type: 'string', enum: ['start', 'stop', 'restart'] },
          kind: KIND,
          account: ACCOUNT,
        },
        required: ['resource', 'action'],
      },
      handler: run(
        async (
          coolify,
          input: {
            resource: string;
            action: 'start' | 'stop' | 'restart';
            kind?: CoolifyKind;
          },
        ) => {
          const { kind, resource } = await findResource(
            coolify,
            input.resource,
            input.kind,
          );
          const result = await coolify.action(
            kind,
            resource.uuid,
            input.action,
          );
          return `${resource.name}: ${result.message ?? `${input.action} pedido`}${result.deployment_uuid ? ` (deploy ${result.deployment_uuid})` : ''}.`;
        },
      ),
    },
    {
      name: 'coolify_deployments',
      description:
        'Os deploys do Coolify: sem nada, os que estão a correr agora; com application, os últimos dessa aplicação; com deployment (o uuid do deploy), o estado e o fim do log dele (para ver porque falhou).',
      inputSchema: {
        type: 'object',
        properties: {
          application: { type: 'string', description: 'O nome ou o uuid.' },
          deployment: { type: 'string', description: 'O uuid do deploy.' },
          lines: {
            type: 'integer',
            description: 'Linhas do log (até 300, omissão 80).',
          },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (
          coolify,
          input: {
            application?: string;
            deployment?: string;
            lines?: number;
          },
        ) => {
          if (input.deployment?.trim()) {
            const deployment = await coolify.deployment(
              input.deployment.trim(),
            );
            const lines = deploymentLogLines(
              deployment.logs,
              Math.min(input.lines ?? 80, 300),
            );
            return [
              `${deployment.application_name ?? ''} — ${deployment.status} — começou ${when(deployment.created_at)}${deployment.finished_at ? `, acabou ${when(deployment.finished_at)}` : ''}${deployment.commit ? ` — ${deployment.commit.slice(0, 7)}` : ''}`,
              lines.length ? lines.join('\n') : 'Sem log.',
            ].join('\n');
          }
          if (input.application?.trim()) {
            const { resource } = await findResource(
              coolify,
              input.application,
              'applications',
            );
            const deployments = await coolify.applicationDeployments(
              resource.uuid,
              15,
            );
            return deployments.length
              ? deployments
                  .map(
                    (item) =>
                      `- ${when(item.created_at)} ${item.status}${item.commit ? ` ${item.commit.slice(0, 7)}` : ''}${item.is_webhook ? ' (webhook)' : ''} — ${item.deployment_uuid}`,
                  )
                  .join('\n')
              : `${resource.name} ainda não tem deploys.`;
          }
          const running = await coolify.runningDeployments();
          return running.length
            ? running
                .map(
                  (item) =>
                    `- ${item.application_name ?? '?'} — ${item.status}${item.server_name ? ` em ${item.server_name}` : ''} — ${item.deployment_uuid}`,
                )
                .join('\n')
            : 'Nenhum deploy a correr.';
        },
      ),
    },
    {
      name: 'coolify_logs',
      description:
        'As últimas linhas dos logs do contentor de uma aplicação, serviço ou base de dados do Coolify (pelo nome ou uuid). Precisa de um token com read:sensitive.',
      inputSchema: {
        type: 'object',
        properties: {
          resource: { type: 'string', description: 'O nome ou o uuid.' },
          kind: KIND,
          lines: {
            type: 'integer',
            description: 'Até 500 (omissão 100).',
          },
          account: ACCOUNT,
        },
        required: ['resource'],
      },
      handler: run(
        async (
          coolify,
          input: { resource: string; kind?: CoolifyKind; lines?: number },
        ) => {
          const { kind, resource } = await findResource(
            coolify,
            input.resource,
            input.kind,
          );
          const logs = await coolify.logs(
            kind,
            resource.uuid,
            Math.min(input.lines ?? 100, 500),
          );
          return logs.trim()
            ? `${resource.name}:\n${logs.slice(-15_000)}`
            : `${resource.name}: sem logs.`;
        },
      ),
    },
    {
      name: 'coolify_envs',
      description:
        'As variáveis de ambiente de uma aplicação, serviço ou base de dados do Coolify: os nomes e se são de build, de runtime ou das pré-visualizações. Os valores são segredos: mostra-os (show_values) só quando ele pedir mesmo o valor.',
      inputSchema: {
        type: 'object',
        properties: {
          resource: { type: 'string', description: 'O nome ou o uuid.' },
          kind: KIND,
          show_values: { type: 'boolean' },
          account: ACCOUNT,
        },
        required: ['resource'],
      },
      handler: run(
        async (
          coolify,
          input: {
            resource: string;
            kind?: CoolifyKind;
            show_values?: boolean;
          },
        ) => {
          const { kind, resource } = await findResource(
            coolify,
            input.resource,
            input.kind,
          );
          const envs = await coolify.envs(kind, resource.uuid);
          if (!envs.length) return `${resource.name} não tem variáveis.`;
          return [
            `${resource.name} — ${envs.length} variáveis:`,
            ...envs.map(
              (env) =>
                `- ${env.key}${env.is_preview ? ' (pré-visualização)' : ''}${env.is_buildtime ? ' build' : ''}${env.is_runtime === false ? '' : ' runtime'}${env.is_shown_once ? ' (bloqueada)' : ''}${input.show_values ? ` = ${env.real_value ?? env.value ?? '(escondido)'}` : ''}`,
            ),
          ].join('\n');
        },
      ),
    },
    {
      name: 'coolify_set_env',
      description:
        'Muda (ou cria, se não existe) uma variável de ambiente de uma aplicação, serviço ou base de dados do Coolify. Só fica a valer no próximo deploy ou reinício (pergunta-lhe se quer fazer logo). Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          resource: { type: 'string', description: 'O nome ou o uuid.' },
          kind: KIND,
          key: { type: 'string' },
          value: { type: 'string' },
          preview: {
            type: 'boolean',
            description: 'A das pré-visualizações (pull requests).',
          },
          account: ACCOUNT,
        },
        required: ['resource', 'key', 'value'],
      },
      handler: run(
        async (
          coolify,
          input: {
            resource: string;
            kind?: CoolifyKind;
            key: string;
            value: string;
            preview?: boolean;
          },
        ) => {
          const key = input.key.trim();
          if (!key) return 'Diz o nome da variável.';
          const { kind, resource } = await findResource(
            coolify,
            input.resource,
            input.kind,
          );
          const done = await coolify.setEnv(kind, resource.uuid, {
            key,
            value: input.value,
            ...(input.preview ? { is_preview: true } : {}),
          });
          return `${done === 'created' ? 'Criei' : 'Mudei'} ${key} em ${resource.name}. Fica a valer no próximo deploy ou reinício.`;
        },
      ),
    },
    {
      name: 'coolify_server',
      description:
        'Um servidor do Coolify (pelo nome ou uuid; omite quando só há um): o IP, se está alcançável e utilizável, o proxy, os recursos que lá correm com o estado e os domínios.',
      inputSchema: {
        type: 'object',
        properties: {
          server: { type: 'string', description: 'O nome ou o uuid.' },
          account: ACCOUNT,
        },
      },
      handler: run(async (coolify, input: { server?: string }) => {
        const servers = await coolify.servers();
        if (!servers.length) return 'O Coolify não tem servidores.';
        const chosen = input.server?.trim()
          ? pickResource(servers, input.server)
          : servers.length === 1
            ? servers[0]
            : null;
        if (!chosen)
          return `Diz qual o servidor: ${servers.map((server) => server.name).join(', ')}.`;
        const [server, resources, domains] = await Promise.all([
          coolify.server(chosen.uuid).catch(() => chosen),
          coolify
            .serverResources(chosen.uuid)
            .catch((): CoolifyResource[] => []),
          coolify
            .serverDomains(chosen.uuid)
            .catch((): { domains?: string[] }[] => []),
        ]);
        const domainGroups: { domains?: string[] }[] = domains;
        const allDomains = domainGroups.flatMap(
          (item): string[] => item.domains ?? [],
        );
        return [
          `${server.name}${server.ip ? ` (${server.ip})` : ''} — ${reachable(server) === false ? 'INALCANÇÁVEL' : 'alcançável'}${(server.is_usable ?? server.settings?.is_usable) === false ? ', não utilizável' : ''}${server.proxy?.type ? ` — proxy ${server.proxy.type}${server.proxy.status ? ` (${server.proxy.status})` : ''}` : ''} — uuid ${server.uuid}`,
          server.description ? `Descrição: ${server.description}` : '',
          `Recursos (${resources.length}):`,
          ...resources
            .slice(0, 100)
            .map(
              (item) =>
                `- ${item.name} [${item.type ?? '?'}] — ${item.status ?? '?'} — uuid ${item.uuid}`,
            ),
          allDomains.length ? `Domínios: ${allDomains.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      }),
    },
  ];
}
