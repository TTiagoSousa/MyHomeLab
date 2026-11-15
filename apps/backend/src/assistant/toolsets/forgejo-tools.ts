import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  ForgejoTarget,
  commentIssue,
  createIssue,
  forgejoTarget,
  getIssue,
  listActionRuns,
  listCommits,
  listIssues,
  listReleases,
  listRepos,
  setIssueState,
} from '../tools/forgejoTools';

const ACCOUNT = {
  type: 'string' as const,
  description:
    'A conta Forgejo (nome, utilizador ou endereço). Omite quando só há uma.',
};

const REPO = {
  type: 'string' as const,
  description:
    'O repositório: "dono/nome", ou só o nome se for do dono do token (ex.: "MyHomeLab").',
};

const NUMBER = {
  type: 'integer' as const,
  description: 'O número da issue ou do pull request (ex.: 12).',
};

// As definições são fixas (a cache vive do prefixo igual); a conta e o token só
// entram nos handlers, que leem apenas as contas deste utilizador.
export function buildForgejoTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(work: (target: ForgejoTarget, input: T) => Promise<string>) =>
    async (input: T & { account?: string }) => {
      const target = await forgejoTarget(
        context.connectedAccountRepository,
        context.userId,
        input.account,
      );
      return typeof target === 'string' ? target : work(target, input);
    };

  return [
    {
      name: 'forgejo_list_repos',
      description:
        'Lista os repositórios do Forgejo a que o token tem acesso: issues e PRs abertos, ramo principal e última atualização.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((target) => listRepos(target)),
    },
    {
      name: 'forgejo_list_issues',
      description:
        'Lista as issues (ou os pull requests) de um repositório, por omissão as abertas.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          repo: REPO,
          state: { type: 'string', enum: ['open', 'closed', 'all'] },
          pull_requests: {
            type: 'boolean',
            description: 'true para listar pull requests em vez de issues.',
          },
          limit: {
            type: 'integer',
            description: 'Quantas (1 a 50, 20 por omissão).',
          },
        },
        required: ['repo'],
      },
      handler: run(listIssues),
    },
    {
      name: 'forgejo_get_issue',
      description:
        'Abre uma issue ou um pull request: a descrição e os últimos comentários.',
      inputSchema: {
        type: 'object',
        properties: { account: ACCOUNT, repo: REPO, number: NUMBER },
        required: ['repo', 'number'],
      },
      handler: run(getIssue),
    },
    {
      name: 'forgejo_create_issue',
      description:
        'Cria uma issue num repositório, com título e descrição (markdown).',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          repo: REPO,
          title: { type: 'string' },
          body: { type: 'string', description: 'A descrição, em markdown.' },
        },
        required: ['repo', 'title'],
      },
      handler: run(createIssue),
    },
    {
      name: 'forgejo_comment_issue',
      description: 'Acrescenta um comentário a uma issue ou a um pull request.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          repo: REPO,
          number: NUMBER,
          body: { type: 'string', description: 'O comentário, em markdown.' },
        },
        required: ['repo', 'number', 'body'],
      },
      handler: run(commentIssue),
    },
    {
      name: 'forgejo_set_issue_state',
      description: 'Fecha ou reabre uma issue.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          repo: REPO,
          number: NUMBER,
          state: { type: 'string', enum: ['open', 'closed'] },
        },
        required: ['repo', 'number', 'state'],
      },
      handler: run(setIssueState),
    },
    {
      name: 'forgejo_list_releases',
      description:
        'As últimas releases de um repositório: tag, data, ficheiros e notas.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          repo: REPO,
          limit: {
            type: 'integer',
            description: 'Quantas (até 20, 5 por omissão).',
          },
        },
        required: ['repo'],
      },
      handler: run(listReleases),
    },
    {
      name: 'forgejo_list_commits',
      description: 'Os últimos commits de um repositório (ou de um ramo).',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          repo: REPO,
          branch: {
            type: 'string',
            description: 'O ramo; omite para o principal.',
          },
          limit: {
            type: 'integer',
            description: 'Quantos (1 a 30, 10 por omissão).',
          },
        },
        required: ['repo'],
      },
      handler: run(listCommits),
    },
    {
      name: 'forgejo_list_action_runs',
      description:
        'As últimas execuções do Forgejo Actions (CI) de um repositório e o estado de cada uma.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          repo: REPO,
          limit: {
            type: 'integer',
            description: 'Quantas (até 30, 10 por omissão).',
          },
        },
        required: ['repo'],
      },
      handler: run(listActionRuns),
    },
  ];
}
