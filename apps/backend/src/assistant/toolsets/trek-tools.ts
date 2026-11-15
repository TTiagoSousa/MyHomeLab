import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import { ConnectedAccount } from 'src/generated/prisma/client/client';
import {
  callTool,
  listTools,
  overview,
  toolHelp,
  trekTarget,
} from '../tools/trekTools';

const ACCOUNT = {
  type: 'string' as const,
  description: 'O TREK (nome ou endereço). Omite quando só há um.',
};

const CALL = {
  type: 'object' as const,
  properties: {
    account: ACCOUNT,
    tool: {
      type: 'string',
      description:
        'O nome da ferramenta do TREK (de trek_tools), ex.: "list_trips", "create_place".',
    },
    arguments: {
      type: 'object',
      description:
        'Os argumentos da ferramenta, como o trek_tool_help os descreve.',
      additionalProperties: true,
    },
  },
  required: ['tool'],
};

// As definições são fixas (a cache vive do prefixo igual): as ferramentas do TREK
// descobrem-se com trek_tools e chamam-se pelo nome. O segredo só entra nos handlers.
export function buildTrekTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(work: (account: ConnectedAccount, input: T) => Promise<string>) =>
    async (input: T & { account?: string }) => {
      const target = await trekTarget(
        context.connectedAccountRepository,
        context.userId,
        input.account,
      );
      return typeof target === 'string' ? target : work(target, input);
    };

  return [
    {
      name: 'trek_overview',
      description:
        'Resumo do TREK (o planeador de viagens): versão, se o MCP está ligado e quantas ferramentas dá, e as viagens.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((account) => overview(account)),
    },
    {
      name: 'trek_tools',
      description:
        'As ferramentas do TREK (a API toda pelo MCP dele): viagens, dias, sítios, reservas, alojamentos, transportes, malas, tarefas, orçamento, colaboração, atlas, diário (journey), ficheiros, tempo, pesquisa de sítios… Filtra por palavras (em inglês) e pelo tipo. Cada uma diz se lê, escreve ou apaga.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          query: {
            type: 'string',
            description: 'Palavras, ex.: "trip", "packing", "reservation".',
          },
          kind: { type: 'string', enum: ['read', 'write'] },
        },
      },
      handler: run(listTools),
    },
    {
      name: 'trek_tool_help',
      description:
        'A descrição inteira e os argumentos (JSON Schema) de uma ferramenta do TREK, antes de a chamar.',
      inputSchema: {
        type: 'object',
        properties: { account: ACCOUNT, name: { type: 'string' } },
        required: ['name'],
      },
      handler: run(toolHelp),
    },
    {
      name: 'trek_read',
      description:
        'Chama uma ferramenta do TREK que só lê (as [lê] do trek_tools).',
      inputSchema: CALL,
      handler: run(
        (
          account,
          input: { tool: string; arguments?: Record<string, unknown> },
        ) => callTool(account, input, false),
      ),
    },
    {
      name: 'trek_write',
      description:
        'Chama uma ferramenta do TREK que cria ou muda (as [escreve]) ou apaga (as [apaga], só com confirm: true e só quando ele pediu para apagar aquilo). As alterações aparecem logo no TREK de todos.',
      inputSchema: {
        ...CALL,
        properties: {
          ...CALL.properties,
          confirm: {
            type: 'boolean',
            description: 'true só nas que apagam, quando ele pediu.',
          },
        },
      },
      handler: run(
        (
          account,
          input: {
            tool: string;
            arguments?: Record<string, unknown>;
            confirm?: boolean;
          },
        ) => callTool(account, input, true),
      ),
    },
  ];
}
