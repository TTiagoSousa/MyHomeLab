import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import { summarizeEmailsToday } from '../tools/summarizeEmailsToday';
import { searchEmails } from '../tools/searchEmails';
import { listConnectedEmails } from '../tools/listConnectedEmails';
import { analyzeInbox } from '../tools/analyzeInbox';
import {
  listEmailRules,
  createEmailRuleTool,
  updateEmailRuleTool,
  deleteEmailRuleTool,
} from '../tools/manageEmailRules';
import {
  getProposalSettingsTool,
  setProposalSettingsTool,
  listEmailProposalsTool,
  analyzeEmailProposalsTool,
  implementEmailProposalTool,
  dismissEmailProposalTool,
} from '../tools/manageEmailProposals';
import {
  readEmail,
  readEmailAttachment,
  draftEmail,
  draftReport,
  modifyEmails,
  trashEmails,
  type DraftInput,
  type ModifyInput,
} from '../tools/emailMessages';

const LABEL_PATHS_SCHEMA = {
  type: 'array' as const,
  description:
    'Caminhos de marcadores a aplicar, ex: [{ "path": "Bancos/Revolut", "labelMode": "ALL_LEVELS" }].',
  items: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string' as const,
        description: 'Caminho separado por barras, ex: "Compras/Amazon".',
      },
      labelMode: {
        type: 'string' as const,
        enum: ['ALL_LEVELS', 'LEAF_ONLY'],
        description:
          'ALL_LEVELS aplica todos os níveis do caminho; LEAF_ONLY só o último.',
      },
    },
    required: ['path'],
  },
};

/**
 * Os campos de uma regra, partilhados pelo criar e pelo alterar. São os mesmos do
 * CreateEmailRuleDto — se lá for acrescentado um campo, é aqui que o agente o ganha.
 */
export const RULE_FIELDS_SCHEMA = {
  name: { type: 'string' as const, description: 'Nome da regra.' },
  isActive: {
    type: 'boolean' as const,
    description: 'Se a regra corre ou não.',
  },
  conditionLogic: {
    type: 'string' as const,
    enum: ['ALL', 'ANY'],
    description: 'ALL exige todas as condições; ANY basta uma.',
  },
  mailKind: {
    type: 'string' as const,
    enum: ['ANY', 'BULK', 'DIRECT'],
    description:
      'Tipo de envio. BULK = só publicidade e newsletters (emails com "lista de correio" ' +
      'ou "cancelar a subscrição"); DIRECT = só emails sem isso (faturas, avisos de conta); ' +
      'ANY = qualquer (omissão). Usa para separar a publicidade de uma empresa dos emails ' +
      'da conta quando vêm do mesmo endereço, ex: no-reply@revolut.com.',
  },
  fromContains: {
    type: 'array' as const,
    items: { type: 'string' as const },
    description: 'Remetentes a apanhar, ex: ["@revolut.com"].',
  },
  subjectContains: {
    type: 'array' as const,
    items: { type: 'string' as const },
    description: 'Textos a procurar no assunto.',
  },
  keywords: {
    type: 'array' as const,
    items: { type: 'string' as const },
    description: 'Palavras a procurar em qualquer parte do email.',
  },
  excludeKeywords: {
    type: 'array' as const,
    items: { type: 'string' as const },
    description: 'Palavras que, se aparecerem, excluem o email.',
  },
  matchType: {
    type: 'string' as const,
    enum: ['CONTAINS', 'EXACT', 'REGEX'],
    description: 'Como comparar. CONTAINS é o normal.',
  },
  hasAttachment: {
    type: 'boolean' as const,
    description: 'Exigir que o email tenha anexo.',
  },
  markAsRead: { type: 'boolean' as const, description: 'Marcar como lido.' },
  markAsImportant: {
    type: 'boolean' as const,
    description: 'Marcar como importante.',
  },
  markAsStarred: {
    type: 'boolean' as const,
    description: 'Marcar com estrela.',
  },
  stopProcessing: {
    type: 'boolean' as const,
    description: 'Impedir que as regras seguintes toquem nestes emails.',
  },
  removeFromInbox: {
    type: 'boolean' as const,
    description: 'Arquivar (tirar da caixa de entrada).',
  },
  removeFromInboxAfterDays: {
    type: 'integer' as const,
    description: 'Arquivar só ao fim de N dias. Omite para arquivar já.',
  },
  removeOnlyIfRead: {
    type: 'boolean' as const,
    description: 'Só arquivar se o email já estiver lido.',
  },
  markAsReadOnRemove: {
    type: 'boolean' as const,
    description: 'Marcar como lido ao arquivar.',
  },
  starredExpiresAfterDays: {
    type: 'integer' as const,
    description: 'Tirar a estrela ao fim de N dias.',
  },
  importantExpiresAfterDays: {
    type: 'integer' as const,
    description: 'Tirar o importante ao fim de N dias.',
  },
  importantExpiresOnStar: {
    type: 'boolean' as const,
    description: 'Tirar o importante quando o email ganhar estrela.',
  },
  labelPaths: LABEL_PATHS_SCHEMA,
};

const ACCOUNT_EMAIL_SCHEMA = {
  type: 'string' as const,
  description: 'Email da conta Gmail. Omite se só houver uma conta ligada.',
};

export function buildEmailTools(context: AgentContext): AgentTool[] {
  const { connectedAccountRepository, emailRuleRepository, userId } = context;

  return [
    {
      name: 'summarize_emails_today',
      description:
        'Resume os emails de hoje de uma conta Gmail ligada, avisando se há algo importante.',
      inputSchema: {
        type: 'object',
        properties: { accountEmail: ACCOUNT_EMAIL_SCHEMA },
      },
      handler: async (input: { accountEmail?: string }) =>
        summarizeEmailsToday(
          input?.accountEmail,
          connectedAccountRepository,
          userId,
          context.ai,
        ),
    },
    {
      name: 'search_emails',
      description:
        'Procura emails numa conta Gmail ligada para qualquer pedido que não seja só "hoje" ' +
        '(ex: de uma pessoa específica, de um período, não lidos, com determinado assunto). ' +
        'Usa a sintaxe de pesquisa do Gmail no campo query (ex: "from:joao@x.com", ' +
        '"after:2026/07/01 before:2026/08/01", "is:unread", "subject:fatura"). Combina termos ' +
        'com espaço para AND. Devolve o messageId, remetente, assunto e prévia de cada resultado ' +
        '(o email inteiro lê-se com read_email).',
      inputSchema: {
        type: 'object',
        properties: {
          accountEmail: ACCOUNT_EMAIL_SCHEMA,
          query: {
            type: 'string',
            description:
              'Pesquisa no formato do Gmail (from:, subject:, after:, before:, is:unread, etc.).',
          },
          maxResults: {
            type: 'integer',
            description: 'Número máximo de resultados (default 25, máximo 50).',
          },
        },
        required: ['query'],
      },
      handler: async (input: {
        accountEmail?: string;
        query: string;
        maxResults?: number;
      }) =>
        searchEmails(
          input.accountEmail,
          input.query,
          input.maxResults,
          connectedAccountRepository,
          userId,
        ),
    },
    {
      name: 'read_email',
      description:
        'Lê um email inteiro (o messageId vem do search_emails): remetente, destinatários, data, ' +
        'o texto todo e a lista dos anexos (pelo nome). Usa para resumir um email, ' +
        'antes de responder ou reencaminhar, e para ver que anexos tem.',
      inputSchema: {
        type: 'object',
        properties: {
          accountEmail: ACCOUNT_EMAIL_SCHEMA,
          messageId: { type: 'string', description: 'O id do email.' },
        },
        required: ['messageId'],
      },
      handler: async (input: { accountEmail?: string; messageId: string }) =>
        readEmail(input, connectedAccountRepository, userId),
    },
    {
      name: 'read_email_attachment',
      description:
        'Lê os anexos de um email: sem filename, todos; com filename, só esse. Texto (txt, csv, ics), ' +
        'Word (.docx) e Excel (.xlsx) chegam como texto; PDF e imagens chegam com um resumo e o ' +
        'conteúdo importante transcrito. Cada anexo traz a impressão digital (sha256): iguais = o ' +
        'mesmo ficheiro. Um email por chamada: dois emails, duas chamadas.',
      inputSchema: {
        type: 'object',
        properties: {
          accountEmail: ACCOUNT_EMAIL_SCHEMA,
          messageId: { type: 'string', description: 'O id do email.' },
          filename: {
            type: 'string',
            description:
              'Só este anexo (o nome como aparece no read_email). Omite para ler todos.',
          },
        },
        required: ['messageId'],
      },
      handler: async (input: {
        accountEmail?: string;
        messageId: string;
        attachmentId?: string;
        filename?: string;
      }) =>
        readEmailAttachment(
          input,
          connectedAccountRepository,
          userId,
          context.ai,
        ),
    },
    {
      name: 'draft_email',
      description:
        'Cria um rascunho no Gmail, sem enviar: um email novo (mode "new": to, subject, text), ' +
        'uma resposta no mesmo fio (mode "reply": messageId e text; replyAll para responder a todos) ' +
        'ou um reencaminhamento com os anexos do original (mode "forward": messageId, to, text). ' +
        'Não envia: no chat aparece-lhe um cartão com o email e o botão Enviar; num disparo fica nos Rascunhos do Gmail.',
      inputSchema: {
        type: 'object',
        properties: {
          accountEmail: ACCOUNT_EMAIL_SCHEMA,
          mode: { type: 'string', enum: ['new', 'reply', 'forward'] },
          messageId: {
            type: 'string',
            description: 'O email a que se responde ou que se reencaminha.',
          },
          to: {
            type: 'string',
            description:
              'Destinatários separados por vírgula. Na resposta, omite (vai para quem enviou).',
          },
          cc: {
            type: 'string',
            description: 'Em cópia, separados por vírgula.',
          },
          subject: {
            type: 'string',
            description:
              'Assunto. Na resposta e no reencaminhar, omite (Re:/Fwd: do original).',
          },
          text: {
            type: 'string',
            description:
              'O texto do email, em texto simples, já com a saudação e a despedida.',
          },
          replyAll: {
            type: 'boolean',
            description:
              'Na resposta: também para os outros destinatários do original.',
          },
          includeAttachments: {
            type: 'boolean',
            description:
              'No reencaminhar: levar os anexos do original (sim por omissão).',
          },
        },
        required: ['mode', 'text'],
      },
      handler: async (input: DraftInput) => {
        const draft = await draftEmail(
          input,
          connectedAccountRepository,
          userId,
        );
        if (typeof draft === 'string') return draft;
        if (context.source !== 'chat' || !context.conversationId) {
          return draftReport(draft);
        }
        const { skipped: _skipped, ...payload } = draft;
        const approval = await context.approvals.create(
          userId,
          'EMAIL_SEND',
          context.agentKey ?? 'admin',
          payload,
          { conversationId: context.conversationId, turnId: context.turnId },
        );
        return draftReport(draft, approval.id);
      },
    },
    {
      name: 'send_email_draft',
      description:
        'Já não envia sozinho: um email só sai quando ele carrega em Enviar no cartão do chat, ou quando diz ' +
        '"envia" numa mensagem nova e o Jarvis decide o cartão com approval_decide. Devolve o cartão desse rascunho.',
      inputSchema: {
        type: 'object',
        properties: {
          accountEmail: ACCOUNT_EMAIL_SCHEMA,
          draftId: { type: 'string', description: 'O draftId do draft_email.' },
        },
        required: ['draftId'],
      },
      handler: async (input: { accountEmail?: string; draftId: string }) => {
        const open = await context.approvals.pending(userId);
        const card = open.find(
          (row) =>
            row.kind === 'EMAIL_SEND' &&
            (row.payload as { draftId?: string }).draftId === input.draftId,
        );
        return card
          ? `O email espera pelo sim dele no cartão ${card.id}. Ele carrega em Enviar, ou diz "envia" numa mensagem nova e o Jarvis decide com approval_decide.`
          : 'Não há nenhum cartão para esse rascunho: cria-o com draft_email numa conversa com ele (num disparo, fica nos Rascunhos do Gmail).';
      },
    },
    {
      name: 'modify_email',
      description:
        'Mexe em emails concretos (os messageId do search_emails): pôr ou tirar marcadores ' +
        '("Bancos/Revolut"), arquivar (archive) ou voltar à caixa de entrada (inbox), lido ou por ler ' +
        '(read), estrela (starred) e importante (important). Para muitos emails do mesmo tipo, ' +
        'é melhor uma regra.',
      inputSchema: {
        type: 'object',
        properties: {
          accountEmail: ACCOUNT_EMAIL_SCHEMA,
          messageIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Os ids dos emails (até 100).',
          },
          addLabels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Marcadores a pôr (criados se não existirem).',
          },
          removeLabels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Marcadores a tirar.',
          },
          archive: {
            type: 'boolean',
            description: 'Tirar da caixa de entrada.',
          },
          inbox: {
            type: 'boolean',
            description: 'Voltar a pôr na caixa de entrada.',
          },
          read: {
            type: 'boolean',
            description: 'true = lido, false = por ler.',
          },
          starred: {
            type: 'boolean',
            description: 'true = pôr estrela, false = tirar.',
          },
          important: {
            type: 'boolean',
            description: 'true = importante, false = tirar.',
          },
        },
        required: ['messageIds'],
      },
      handler: async (input: ModifyInput) =>
        modifyEmails(input, connectedAccountRepository, userId),
    },
    {
      name: 'trash_email',
      description:
        'Manda emails para o lixo (o Gmail guarda-os 30 dias) ou tira-os de lá (restore). ' +
        'Não apaga de vez. Só quando ele pedir esses emails.',
      inputSchema: {
        type: 'object',
        properties: {
          accountEmail: ACCOUNT_EMAIL_SCHEMA,
          messageIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Os ids dos emails (até 100).',
          },
          restore: {
            type: 'boolean',
            description: 'Tirar do lixo em vez de mandar.',
          },
        },
        required: ['messageIds'],
      },
      handler: async (input: {
        accountEmail?: string;
        messageIds: string[];
        restore?: boolean;
      }) => trashEmails(input, connectedAccountRepository, userId),
    },
    {
      name: 'list_connected_emails',
      description: 'Lista os emails das contas Gmail ligadas.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () =>
        listConnectedEmails(connectedAccountRepository, userId),
    },
    {
      name: 'analyze_inbox',
      description:
        'Retrato da caixa de uma conta Gmail nos últimos N dias (30 por omissão, máximo 90): ' +
        'por remetente, quantos emails, quantos por ler, quantos de publicidade, quantos ainda na ' +
        'caixa de entrada e há quanto tempo, e que regras já o apanham (ou SEM REGRA); e, por ' +
        'regra, quantos emails apanhou e se limpa alguma coisa. Usa sempre antes de propor regras.',
      inputSchema: {
        type: 'object',
        properties: {
          accountEmail: ACCOUNT_EMAIL_SCHEMA,
          days: {
            type: 'integer',
            description: 'Quantos dias para trás (30 por omissão, máximo 90).',
          },
        },
      },
      handler: async (input: { accountEmail?: string; days?: number }) =>
        analyzeInbox(
          input?.accountEmail,
          input?.days,
          connectedAccountRepository,
          emailRuleRepository,
          userId,
        ),
    },
    {
      name: 'list_email_rules',
      description:
        'Lista as regras de organização de uma conta Gmail, por ordem de execução, com as ' +
        'condições e ações de cada uma. Usa isto antes de criar ou alterar regras.',
      inputSchema: {
        type: 'object',
        properties: { accountEmail: ACCOUNT_EMAIL_SCHEMA },
      },
      handler: async (input: { accountEmail?: string }) =>
        listEmailRules(
          input?.accountEmail,
          connectedAccountRepository,
          emailRuleRepository,
          userId,
        ),
    },
    {
      name: 'create_email_rule',
      description:
        'Cria uma regra de organização do Gmail numa conta ligada. Define as condições ' +
        '(de quem, que assunto, que palavras) e o que fazer (marcadores a aplicar, marcar como ' +
        'lido/importante/estrela, arquivar). Os marcadores que não existirem são criados no Gmail.',
      inputSchema: {
        type: 'object',
        properties: {
          accountEmail: ACCOUNT_EMAIL_SCHEMA,
          ...RULE_FIELDS_SCHEMA,
        },
      },
      handler: async (input: Record<string, unknown>) =>
        createEmailRuleTool(
          input,
          connectedAccountRepository,
          emailRuleRepository,
          userId,
        ),
    },
    {
      name: 'update_email_rule',
      description:
        'Altera uma regra existente, identificada pelo nome. Só os campos que passares ' +
        'são alterados; os outros ficam como estavam.',
      inputSchema: {
        type: 'object',
        properties: {
          accountEmail: ACCOUNT_EMAIL_SCHEMA,
          ruleName: {
            type: 'string',
            description: 'Nome exato da regra a alterar.',
          },
          ...RULE_FIELDS_SCHEMA,
        },
        required: ['ruleName'],
      },
      handler: async (input: Record<string, unknown>) =>
        updateEmailRuleTool(
          input as unknown as Parameters<typeof updateEmailRuleTool>[0],
          connectedAccountRepository,
          emailRuleRepository,
          userId,
        ),
    },
    {
      name: 'delete_email_rule',
      description:
        'Apaga uma regra existente, identificada pelo nome. Não se desfaz — confirma com ' +
        'o utilizador antes de usares.',
      inputSchema: {
        type: 'object',
        properties: {
          accountEmail: ACCOUNT_EMAIL_SCHEMA,
          ruleName: {
            type: 'string',
            description: 'Nome exato da regra a apagar.',
          },
        },
        required: ['ruleName'],
      },
      handler: async (input: { accountEmail?: string; ruleName: string }) =>
        deleteEmailRuleTool(
          input,
          connectedAccountRepository,
          emailRuleRepository,
          userId,
        ),
    },
    {
      name: 'get_proposal_settings',
      description:
        'Mostra o cartão "Regras propostas" de uma conta Gmail: se a análise automática está ' +
        'ligada e de quanto em quanto tempo, ao fim de quantos dias uma proposta passa a regra ' +
        'sozinha, e quando foi a última análise.',
      inputSchema: {
        type: 'object',
        properties: { accountEmail: ACCOUNT_EMAIL_SCHEMA },
      },
      handler: async (input: { accountEmail?: string }) =>
        getProposalSettingsTool(
          input?.accountEmail,
          connectedAccountRepository,
          userId,
        ),
    },
    {
      name: 'set_proposal_settings',
      description:
        'Muda o cartão "Regras propostas": ligar ou desligar a análise automática, a ' +
        'frequência, e "Implementar sozinhas após (dias)". Só muda os campos que passares.',
      inputSchema: {
        type: 'object',
        properties: {
          accountEmail: ACCOUNT_EMAIL_SCHEMA,
          enabled: {
            type: 'boolean',
            description:
              'false desliga a análise automática; true liga (uma vez por dia, se não disseres a frequência).',
          },
          frequency: {
            type: 'string',
            enum: [
              'EVERY_15_MINUTES',
              'EVERY_30_MINUTES',
              'HOURLY',
              'EVERY_2_HOURS',
              'EVERY_4_HOURS',
              'EVERY_6_HOURS',
              'EVERY_8_HOURS',
              'DAILY',
              'WEEKLY',
            ],
            description:
              'De quanto em quanto tempo se analisa (liga a análise).',
          },
          autoImplementAfterDays: {
            type: ['integer', 'null'],
            description:
              'Ao fim de quantos dias (1 a 60) uma proposta em que ele não mexeu passa a regra sozinha; null = nunca.',
          },
        },
      },
      handler: async (input: Parameters<typeof setProposalSettingsTool>[0]) =>
        setProposalSettingsTool(input, connectedAccountRepository, userId),
    },
    {
      name: 'analyze_email_proposals',
      description:
        'O botão "Analisar e propor": analisa os emails sem marcador e grava propostas de ' +
        'regras para ele aceitar ou recusar. Demora um pouco e gasta a chave de IA dele.',
      inputSchema: {
        type: 'object',
        properties: { accountEmail: ACCOUNT_EMAIL_SCHEMA },
      },
      handler: async (input: { accountEmail?: string }) =>
        analyzeEmailProposalsTool(
          input?.accountEmail,
          connectedAccountRepository,
          context.emailProposals,
          userId,
        ),
    },
    {
      name: 'list_email_proposals',
      description:
        'Lista as propostas de regras pendentes de uma conta, com o id, a regra e o motivo.',
      inputSchema: {
        type: 'object',
        properties: { accountEmail: ACCOUNT_EMAIL_SCHEMA },
      },
      handler: async (input: { accountEmail?: string }) =>
        listEmailProposalsTool(
          input?.accountEmail,
          connectedAccountRepository,
          context.emailProposals,
          userId,
        ),
    },
    {
      name: 'implement_email_proposal',
      description:
        'Aceita uma proposta pendente (pelo id de list_email_proposals) e cria a regra, ou ' +
        'todas com all = true. Só depois de ele dizer quais.',
      inputSchema: {
        type: 'object',
        properties: {
          accountEmail: ACCOUNT_EMAIL_SCHEMA,
          proposalId: { type: 'string', description: 'O id da proposta.' },
          all: {
            type: 'boolean',
            description: 'true aceita todas as pendentes.',
          },
        },
      },
      handler: async (input: {
        accountEmail?: string;
        proposalId?: string;
        all?: boolean;
      }) =>
        implementEmailProposalTool(
          input,
          connectedAccountRepository,
          context.emailProposals,
          userId,
        ),
    },
    {
      name: 'dismiss_email_proposal',
      description:
        'Recusa uma proposta pendente, pelo id de list_email_proposals.',
      inputSchema: {
        type: 'object',
        properties: {
          accountEmail: ACCOUNT_EMAIL_SCHEMA,
          proposalId: { type: 'string', description: 'O id da proposta.' },
        },
        required: ['proposalId'],
      },
      handler: async (input: { accountEmail?: string; proposalId: string }) =>
        dismissEmailProposalTool(
          input,
          connectedAccountRepository,
          context.emailProposals,
          userId,
        ),
    },
  ];
}
