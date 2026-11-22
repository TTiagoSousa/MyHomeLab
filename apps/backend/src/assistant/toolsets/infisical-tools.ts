import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import {
  createInfisicalClient,
  InfisicalClient,
  InfisicalLocation,
  InfisicalProject,
  InfisicalSecret,
  infisicalUpdate,
} from 'src/infisical/infisical.client';
import { lisbonStamp } from 'src/utils/lisbonTime';

const fold = (text: string) => text.trim().toLowerCase();

const ACCOUNT = {
  type: 'string' as const,
  description: 'O Infisical (nome ou endereço). Omite quando só há um.',
};

const PLACE = {
  project: {
    type: 'string' as const,
    description: 'O projeto (nome, slug ou id). Omite quando só há um.',
  },
  environment: {
    type: 'string' as const,
    description:
      'O ambiente (slug, ex.: dev, staging, prod). Omite quando o projeto só tem um.',
  },
  path: {
    type: 'string' as const,
    description: 'A pasta, ex.: "/" (omissão) ou "/backend/db".',
  },
};

interface PlaceInput {
  project?: string;
  environment?: string;
  path?: string;
}

/** O Infisical a usar: o único, ou o que bate com o nome ou o endereço. */
export async function infisicalTarget(
  context: AgentContext,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await context.connectedAccountRepository.findAllByUser(
      context.userId,
      ConnectionProvider.INFISICAL,
    )
  ).filter(
    (account) =>
      account.isActive &&
      account.baseUrl &&
      account.apiClientId &&
      account.apiClientSecret,
  );
  if (!accounts.length) {
    return 'Não há nenhum Infisical ligado. Liga-o em Apps ligadas → Infisical.';
  }
  const label = (account: ConnectedAccount) =>
    `${account.displayName ?? 'Infisical'} (${account.baseUrl})`;
  const matches = wanted?.trim()
    ? accounts.filter((account) => fold(label(account)).includes(fold(wanted)))
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o Infisical: ${accounts.map(label).join(', ')}.`;
  }
  return matches[0];
}

/** O projeto e o ambiente pedidos (ou os únicos), já validados. */
export async function resolvePlace(
  infisical: InfisicalClient,
  input: PlaceInput,
): Promise<{ project: InfisicalProject; place: InfisicalLocation }> {
  const projects = await infisical.projects();
  if (!projects.length) {
    throw new Error(
      'a identidade não vê nenhum projeto: acrescenta-a a um projeto em Access Control → Machine Identities',
    );
  }
  const wanted = input.project ? fold(input.project) : '';
  const matches = wanted
    ? projects.filter(
        (project) =>
          project.id === input.project?.trim() ||
          fold(project.name) === wanted ||
          fold(project.slug ?? '') === wanted,
      )
    : projects;
  const partial =
    wanted && !matches.length
      ? projects.filter((project) => fold(project.name).includes(wanted))
      : matches;
  if (partial.length !== 1) {
    throw new Error(
      `diz qual o projeto: ${projects.map((project) => project.name).join(', ')}`,
    );
  }
  const project = partial[0];
  const envs = project.environments;
  const env = input.environment
    ? envs.find(
        (item) =>
          fold(item.slug) === fold(input.environment ?? '') ||
          fold(item.name) === fold(input.environment ?? ''),
      )
    : envs.length === 1
      ? envs[0]
      : undefined;
  if (!env) {
    throw new Error(
      `diz qual o ambiente de ${project.name}: ${envs.map((item) => item.slug).join(', ') || 'não tem nenhum'}`,
    );
  }
  return {
    project,
    place: {
      projectId: project.id,
      environment: env.slug,
      secretPath: input.path?.trim() || '/',
    },
  };
}

const where = (project: InfisicalProject, place: InfisicalLocation) =>
  `${project.name}/${place.environment}${place.secretPath && place.secretPath !== '/' ? place.secretPath : ''}`;

const secretLine = (secret: InfisicalSecret, values: boolean) =>
  `- ${secret.secretPath && secret.secretPath !== '/' ? `${secret.secretPath}/` : ''}${secret.secretKey}${values && !secret.secretValueHidden ? ` = ${secret.secretValue ?? ''}` : ''}${secret.secretComment ? ` — ${secret.secretComment.slice(0, 120)}` : ''}${secret.type === 'personal' ? ' (pessoal)' : ''}`;

const approvalNote = (result: { approval?: unknown }) =>
  result.approval
    ? ' Este ambiente pede aprovação: ficou um pedido à espera no Infisical.'
    : '';

export function buildInfisicalTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(
      work: (
        infisical: InfisicalClient,
        input: T,
        account: ConnectedAccount,
      ) => Promise<string>,
    ) =>
    async (input: T & { account?: string }) => {
      const account = await infisicalTarget(context, input.account);
      if (typeof account === 'string') return account;
      try {
        return await work(
          createInfisicalClient(
            account.baseUrl ?? '',
            account.apiClientId ?? '',
            account.apiClientSecret ?? '',
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
      name: 'infisical_overview',
      description:
        'O Infisical (o gestor de segredos): os projetos que a Machine Identity vê, os ambientes de cada um com quantos segredos têm (contando as pastas) e se há versão nova do Infisical. Não mostra valores.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (infisical, _input, account) => {
        const [projects, update] = await Promise.all([
          infisical.projects(),
          infisicalUpdate(account.baseUrl ?? ''),
        ]);
        if (!projects.length) {
          return 'A identidade não vê nenhum projeto: acrescenta-a a um projeto em Access Control → Machine Identities.';
        }
        const lines: string[] = [
          `Infisical em ${account.baseUrl}${update ? ` — há uma versão nova: ${update}` : ''}.`,
          `${projects.length} projetos:`,
        ];
        for (const project of projects.slice(0, 15)) {
          const counts = await Promise.all(
            project.environments.map(async (env) => {
              try {
                const { secrets } = await infisical.secrets(
                  {
                    projectId: project.id,
                    environment: env.slug,
                    secretPath: '/',
                  },
                  { recursive: true },
                );
                return `${env.slug}: ${secrets.length}`;
              } catch {
                return `${env.slug}: sem acesso`;
              }
            }),
          );
          lines.push(
            `- ${project.name}${project.slug ? ` (${project.slug})` : ''} — ${counts.join(', ') || 'sem ambientes'}`,
          );
        }
        if (projects.length > 15)
          lines.push(`(e mais ${projects.length - 15} projetos)`);
        return lines.join('\n');
      }),
    },
    {
      name: 'infisical_secrets',
      description:
        'Os segredos de um projeto e ambiente do Infisical, numa pasta (com recursive, também as subpastas). Por omissão só os nomes e os comentários; com values: true mostra também os valores — pede-os só quando ele quiser ver os valores. Filtra por texto no nome.',
      inputSchema: {
        type: 'object',
        properties: {
          ...PLACE,
          recursive: { type: 'boolean' },
          values: { type: 'boolean' },
          search: { type: 'string' },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (
          infisical,
          input: PlaceInput & {
            recursive?: boolean;
            values?: boolean;
            search?: string;
          },
        ) => {
          const { project, place } = await resolvePlace(infisical, input);
          const { secrets, imports } = await infisical.secrets(place, {
            recursive: input.recursive,
            values: input.values,
          });
          const found = secrets.filter(
            (secret) =>
              !input.search ||
              fold(secret.secretKey).includes(fold(input.search)),
          );
          const lines = [
            `${found.length} segredos em ${where(project, place)}:`,
            ...found
              .slice(0, 300)
              .map((secret) => secretLine(secret, Boolean(input.values))),
          ];
          if (imports.length) {
            lines.push(
              `Importa também: ${imports.map((item) => `${item.environment}${item.secretPath} (${item.secrets.length})`).join(', ')}.`,
            );
          }
          return lines.join('\n');
        },
      ),
    },
    {
      name: 'infisical_secret_get',
      description:
        'Um segredo do Infisical pelo nome, com o valor, o comentário, a versão e quando mudou. Com expand, resolve as referências ${OUTRO} no valor. Usa só quando ele precisar do valor.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          ...PLACE,
          expand: { type: 'boolean' },
          account: ACCOUNT,
        },
        required: ['name'],
      },
      handler: run(
        async (
          infisical,
          input: PlaceInput & { name: string; expand?: boolean },
        ) => {
          const { project, place } = await resolvePlace(infisical, input);
          const secret = await infisical.secret(input.name, place, {
            expand: input.expand,
          });
          return [
            `${secret.secretKey} (${where(project, place)}) = ${secret.secretValue ?? ''}`,
            secret.secretComment ? `Comentário: ${secret.secretComment}` : '',
            `Versão ${secret.version ?? '?'}, mudou ${lisbonStamp(secret.updatedAt, '?')}.`,
          ]
            .filter(Boolean)
            .join('\n');
        },
      ),
    },
    {
      name: 'infisical_secret_set',
      description:
        'Cria um segredo no Infisical ou muda um que já existe (o valor, o comentário ou o nome, com new_name). Num ambiente com aprovação fica um pedido à espera. Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          value: { type: 'string' },
          comment: { type: 'string' },
          new_name: { type: 'string' },
          ...PLACE,
          account: ACCOUNT,
        },
        required: ['name'],
      },
      handler: run(
        async (
          infisical,
          input: PlaceInput & {
            name: string;
            value?: string;
            comment?: string;
            new_name?: string;
          },
        ) => {
          const { project, place } = await resolvePlace(infisical, input);
          const exists = await infisical
            .secret(input.name, place)
            .then(() => true)
            .catch((error: unknown) => {
              if (error instanceof Error && /não encontrou/.test(error.message))
                return false;
              throw error;
            });
          if (!exists) {
            if (input.value === undefined)
              return `${input.name} não existe em ${where(project, place)}: diz o valor para o criar.`;
            const result = await infisical.createSecret(input.name, place, {
              value: input.value,
              comment: input.comment,
            });
            return `Criei ${input.name} em ${where(project, place)}.${approvalNote(result)}`;
          }
          if (
            input.value === undefined &&
            input.comment === undefined &&
            !input.new_name
          )
            return 'Diz o que mudar: value, comment ou new_name.';
          const result = await infisical.updateSecret(input.name, place, {
            value: input.value,
            comment: input.comment,
            newName: input.new_name,
          });
          return `Mudei ${input.name}${input.new_name ? ` (agora ${input.new_name})` : ''} em ${where(project, place)}.${approvalNote(result)}`;
        },
      ),
    },
    {
      name: 'infisical_secret_delete',
      description:
        'Apaga um segredo do Infisical (fica nas versões antigas do Infisical, mas sai das apps que o usam). Confirma com ele antes, dizendo o nome, o projeto e o ambiente.',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string' }, ...PLACE, account: ACCOUNT },
        required: ['name'],
      },
      handler: run(async (infisical, input: PlaceInput & { name: string }) => {
        const { project, place } = await resolvePlace(infisical, input);
        const result = await infisical.deleteSecret(input.name, place);
        return `Apaguei ${input.name} de ${where(project, place)}.${approvalNote(result)}`;
      }),
    },
    {
      name: 'infisical_folders',
      description:
        'As pastas de um projeto e ambiente do Infisical (com recursive, a árvore toda a partir da pasta pedida).',
      inputSchema: {
        type: 'object',
        properties: {
          ...PLACE,
          recursive: { type: 'boolean' },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (infisical, input: PlaceInput & { recursive?: boolean }) => {
          const { project, place } = await resolvePlace(infisical, input);
          const folders = await infisical.folders(place, {
            recursive: input.recursive,
          });
          if (!folders.length) return `Sem pastas em ${where(project, place)}.`;
          return [
            `Pastas em ${where(project, place)}:`,
            ...folders
              .slice(0, 300)
              .map(
                (folder) =>
                  `- ${folder.relativePath ?? folder.path ?? folder.name}${folder.description ? ` — ${folder.description}` : ''}`,
              ),
          ].join('\n');
        },
      ),
    },
    {
      name: 'infisical_folder_create',
      description:
        'Cria uma pasta no Infisical, dentro da pasta path (omissão "/"). O nome só leva letras, números, - e _. Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          ...PLACE,
          account: ACCOUNT,
        },
        required: ['name'],
      },
      handler: run(
        async (
          infisical,
          input: PlaceInput & { name: string; description?: string },
        ) => {
          const { project, place } = await resolvePlace(infisical, input);
          const folder = await infisical.createFolder(place, {
            name: input.name,
            description: input.description,
          });
          return `Criei a pasta ${folder?.path ?? input.name} em ${where(project, place)}.`;
        },
      ),
    },
  ];
}
