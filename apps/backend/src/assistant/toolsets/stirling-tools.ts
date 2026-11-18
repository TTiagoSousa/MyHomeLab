import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  StirlingInput,
  StirlingSave,
  changeSettings,
  describeOperation,
  listOperations,
  listResults,
  overview,
  readSettings,
  runOperation,
  safely,
  stirlingTarget,
} from '../tools/stirlingTools';
import { ConnectedAccount } from 'src/generated/prisma/client/client';

const ACCOUNT = {
  type: 'string' as const,
  description: 'O Stirling-PDF (nome ou endereço). Omite quando só há um.',
};

const OPERATION = {
  type: 'string' as const,
  description:
    'A operação, como a stirling_operations a mostra (ex.: misc/compress-pdf).',
};

// As definições são fixas (a cache vive do prefixo igual); a chave só entra nos handlers,
// que leem apenas as contas deste utilizador.
export function buildStirlingTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(work: (account: ConnectedAccount, input: T) => Promise<string>) =>
    async (input: T & { account?: string }) => {
      const account = await stirlingTarget(
        context.connectedAccountRepository,
        context.userId,
        input.account,
      );
      return typeof account === 'string'
        ? account
        : safely(() => work(account, input));
    };

  return [
    {
      name: 'stirling_overview',
      description:
        'O Stirling-PDF: estado, versão, quantas operações há por área, as desligadas no servidor e se o MCP está ligado.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((account) => overview(account)),
    },
    {
      name: 'stirling_operations',
      description:
        'As operações do Stirling-PDF (comprimir, OCR, juntar, dividir, rodar, converter, marca de água, proteger, assinar, redigir…), lidas do próprio servidor. Filtra com search (palavras em inglês: compress, ocr, merge, split, convert…).',
      inputSchema: {
        type: 'object',
        properties: { account: ACCOUNT, search: { type: 'string' } },
      },
      handler: run((account, input: { search?: string }) =>
        listOperations(account, input.search),
      ),
    },
    {
      name: 'stirling_describe',
      description:
        'Os parâmetros de uma operação (nome, tipo, valores possíveis, por omissão, obrigatórios e os campos de ficheiro).',
      inputSchema: {
        type: 'object',
        properties: { account: ACCOUNT, operation: OPERATION },
        required: ['operation'],
      },
      handler: run((account, input: { operation: string }) =>
        describeOperation(account, input.operation),
      ),
    },
    {
      name: 'stirling_run',
      description:
        'Corre uma operação do Stirling-PDF. Os ficheiros vêm de inputs: um documento do Paperless (paperless_id; original: true para o original sem OCR), um ficheiro do Nextcloud (nextcloud_path) ou um resultado anterior (result); field escolhe o campo quando a operação tem mais que um. O resultado fica guardado 2 horas (para encadear) e, com save, vai para o Paperless como documento novo ou para um caminho do Nextcloud — o original nunca é substituído.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          operation: OPERATION,
          inputs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                paperless_id: { type: 'number' },
                paperless: {
                  type: 'string',
                  description: 'O Paperless (quando há mais que um).',
                },
                original: { type: 'boolean' },
                nextcloud_path: { type: 'string' },
                nextcloud: {
                  type: 'string',
                  description: 'O Nextcloud (quando há mais que um).',
                },
                result: { type: 'string' },
              },
            },
          },
          parameters: {
            type: 'object',
            description:
              'Os parâmetros da operação (vê-os com stirling_describe).',
          },
          save: {
            type: 'object',
            properties: {
              paperless: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  account: { type: 'string' },
                },
              },
              nextcloud: {
                type: 'object',
                properties: {
                  path: { type: 'string' },
                  account: { type: 'string' },
                },
                required: ['path'],
              },
            },
          },
        },
        required: ['operation'],
      },
      handler: run(
        (
          account,
          input: {
            operation: string;
            inputs?: StirlingInput[];
            parameters?: Record<string, unknown>;
            save?: StirlingSave;
          },
        ) =>
          runOperation(
            account,
            context.connectedAccountRepository,
            context.userId,
            input,
          ),
      ),
    },
    {
      name: 'stirling_results',
      description:
        'Os resultados guardados das últimas 2 horas (para usar como input noutra operação).',
      inputSchema: { type: 'object', properties: {} },
      handler: () => Promise.resolve(listResults(context.userId)),
    },
    {
      name: 'stirling_settings',
      description:
        'As definições do servidor Stirling-PDF (precisa de uma chave de administrador), toda ou uma secção (ex.: system, ui, security, endpoints), e as que esperam um reinício. Os segredos vêm escondidos.',
      inputSchema: {
        type: 'object',
        properties: { account: ACCOUNT, section: { type: 'string' } },
      },
      handler: run((account, input: { section?: string }) =>
        readSettings(account, input.section),
      ),
    },
    {
      name: 'stirling_set_settings',
      description:
        'Muda definições do servidor Stirling-PDF em notação de pontos (ex.: { "system.defaultLocale": "pt_PT" }); valem depois de reiniciar. Sem confirm mostra o antes e o depois; só com o sim dele chama com confirm: true. Segredos nunca.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          settings: { type: 'object' },
          confirm: { type: 'boolean' },
        },
        required: ['settings'],
      },
      handler: run(
        (
          account,
          input: { settings: Record<string, unknown>; confirm?: boolean },
        ) => changeSettings(account, input),
      ),
    },
  ];
}
