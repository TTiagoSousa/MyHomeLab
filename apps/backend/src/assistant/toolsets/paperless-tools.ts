import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import { ConnectedAccount } from 'src/generated/prisma/client/client';
import {
  PAPERLESS_MATCHING,
  PAPERLESS_OBJECTS,
} from 'src/paperless/paperless.client';
import {
  bulkEdit,
  changeSettings,
  documentDetail,
  listAutomations,
  listMetadata,
  listTasks,
  overview,
  paperlessTarget,
  readSettings,
  saveObject,
  searchDocuments,
  updateDocument,
} from '../tools/paperlessTools';

const ACCOUNT = {
  type: 'string' as const,
  description: 'O Paperless (nome ou endereço). Omite quando só há um.',
};

const NAME_OR_ID = {
  type: ['string', 'integer'] as ('string' | 'integer')[],
};

const NAMES_OR_IDS = {
  type: 'array' as const,
  items: NAME_OR_ID,
  description: 'Nomes ou ids (de paperless_metadata).',
};

const CLEARABLE = {
  type: ['string', 'integer', 'null'] as ('string' | 'integer' | 'null')[],
  description: 'O nome ou o id; null tira-o.',
};

// As definições são fixas (a cache vive do prefixo igual); o token só entra nos
// handlers, que leem apenas as contas deste utilizador.
export function buildPaperlessTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(work: (account: ConnectedAccount, input: T) => Promise<string>) =>
    async (input: T & { account?: string }) => {
      const target = await paperlessTarget(
        context.connectedAccountRepository,
        context.userId,
        input.account,
      );
      return typeof target === 'string' ? target : work(target, input);
    };

  return [
    {
      name: 'paperless_overview',
      description:
        'Resumo do Paperless (os documentos digitalizados): versão, de quem é o token, quantos documentos e quantos na caixa de entrada (por arrumar), e — de um superutilizador — o disco, a saúde (base de dados, Redis, índice, classificador) e as tarefas falhadas.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((account) => overview(account)),
    },
    {
      name: 'paperless_search',
      description:
        'Procura documentos. query é a pesquisa no texto todo (OCR), com a sintaxe do Paperless ("fatura edp", "iban:*"); title procura no título e no texto. Os filtros juntam-se: tags (todas), correspondent, document_type, storage_path (nome ou id), created_after/created_before (AAAA-MM-DD), inbox (só os por arrumar). Devolve o id de cada um.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          query: { type: 'string' },
          title: { type: 'string' },
          tags: NAMES_OR_IDS,
          correspondent: NAME_OR_ID,
          document_type: NAME_OR_ID,
          storage_path: NAME_OR_ID,
          created_after: { type: 'string' },
          created_before: { type: 'string' },
          inbox: { type: 'boolean' },
          limit: { type: 'integer', description: 'Até 100 (por omissão 25).' },
        },
      },
      handler: run(searchDocuments),
    },
    {
      name: 'paperless_document',
      description:
        'Um documento: data, correspondente, tipo, caminho, ASN, etiquetas, campos, notas e o texto (OCR), para o ler.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          id: { type: 'integer' },
          chars: {
            type: 'integer',
            description: 'Quanto texto (por omissão 3000, até 20000).',
          },
        },
        required: ['id'],
      },
      handler: run(documentDetail),
    },
    {
      name: 'paperless_metadata',
      description:
        'As etiquetas (tags), os correspondentes, os tipos de documento, os caminhos de armazenamento ou os campos personalizados (custom_fields), com o id, quantos documentos e a regra de associação automática.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          kind: {
            type: 'string',
            enum: [...PAPERLESS_OBJECTS, 'custom_fields'],
          },
          query: { type: 'string', description: 'Parte do nome.' },
        },
        required: ['kind'],
      },
      handler: run(listMetadata),
    },
    {
      name: 'paperless_tasks',
      description:
        'As tarefas recentes do Paperless (ficheiros a processar, a classificação, o correio), com as que falharam e porquê.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          failed_only: { type: 'boolean' },
          limit: { type: 'integer', description: 'Até 100 (por omissão 25).' },
        },
      },
      handler: run(listTasks),
    },
    {
      name: 'paperless_automations',
      description:
        'Os fluxos de trabalho e as regras do correio do Paperless (só para ver).',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((account) => listAutomations(account)),
    },
    {
      name: 'paperless_settings',
      description:
        'A configuração da aplicação do Paperless (OCR: língua, modo, páginas, DPI, limpeza; código de barras; título da app; IA…), só de um superutilizador. Os segredos não se mostram; os fixados no ambiente dizem-no.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((account) => readSettings(account)),
    },
    {
      name: 'paperless_update_document',
      description:
        'Arruma um documento: title, add_tags / remove_tags, correspondent, document_type, storage_path (nome ou id; null tira), created (AAAA-MM-DD), archive_serial_number e uma note. Só muda o que passares e devolve o que estava antes. Não apaga documentos.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          id: { type: 'integer' },
          title: { type: 'string' },
          add_tags: NAMES_OR_IDS,
          remove_tags: NAMES_OR_IDS,
          correspondent: CLEARABLE,
          document_type: CLEARABLE,
          storage_path: CLEARABLE,
          created: { type: 'string' },
          archive_serial_number: { type: ['integer', 'null'] },
          note: { type: 'string' },
        },
        required: ['id'],
      },
      handler: run(updateDocument),
    },
    {
      name: 'paperless_bulk_edit',
      description:
        'O mesmo arranjo em vários documentos (ids de paperless_search): pôr ou tirar etiquetas, mudar o correspondente, o tipo ou o caminho. Sem confirm mostra o que vai mudar; com confirm: true aplica.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          documents: { type: 'array', items: { type: 'integer' } },
          add_tags: NAMES_OR_IDS,
          remove_tags: NAMES_OR_IDS,
          correspondent: CLEARABLE,
          document_type: CLEARABLE,
          storage_path: CLEARABLE,
          confirm: { type: 'boolean' },
        },
        required: ['documents'],
      },
      handler: run(bulkEdit),
    },
    {
      name: 'paperless_save_object',
      description:
        'Sem id cria uma etiqueta, um correspondente, um tipo ou um caminho; com id muda-o. matching é a associação automática aos documentos novos (auto aprende com os que já estão arrumados; any/all/literal/regex/fuzzy usam o texto em match). Etiquetas: color (#rrggbb) e inbox. Caminhos: path (ex.: "{{ correspondent }}/{{ created_year }}/{{ title }}"). Não apaga.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          kind: { type: 'string', enum: [...PAPERLESS_OBJECTS] },
          id: { type: 'integer' },
          name: { type: 'string' },
          matching: { type: 'string', enum: [...PAPERLESS_MATCHING] },
          match: { type: 'string' },
          case_insensitive: { type: 'boolean' },
          color: { type: 'string' },
          inbox: { type: 'boolean' },
          path: { type: 'string' },
        },
        required: ['kind'],
      },
      handler: run(saveObject),
    },
    {
      name: 'paperless_set_settings',
      description:
        'Muda a configuração da aplicação do Paperless (superutilizador). changes só com o que muda, com os nomes do paperless_settings (ex.: {"language":"por+eng","deskew":true}); null volta ao valor do ambiente. Sem confirm mostra o antes → depois; com confirm: true aplica. Os segredos não se mudam daqui.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          changes: { type: 'object' },
          confirm: { type: 'boolean' },
        },
        required: ['changes'],
      },
      handler: run(changeSettings),
    },
  ];
}
