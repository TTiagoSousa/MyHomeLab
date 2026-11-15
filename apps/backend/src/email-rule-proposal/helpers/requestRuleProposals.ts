import type Anthropic from '@anthropic-ai/sdk';
import type { AiClient } from 'src/ai-credential/ai-client';
import { SUBAGENT_MODEL } from 'src/assistant/claude-agent.client';
import { RULE_FIELDS_SCHEMA } from 'src/assistant/toolsets/email-tools';
import { ANALYSIS_DAYS, UnlabeledSummary } from './collectUnlabeledSenders';

export interface ExistingProposal {
  id: string;
  rule: Record<string, unknown>;
  reason: string;
  userEdited: boolean;
}

export interface ProposalEvidence {
  emails: number;
  unread: number;
  bulk: number;
  senders: string[];
}

export type ProposalChange =
  | {
      action: 'create';
      rule: Record<string, unknown>;
      reason: string;
      evidence?: ProposalEvidence;
    }
  | {
      action: 'update';
      id: string;
      rule: Record<string, unknown>;
      reason: string;
      evidence?: ProposalEvidence;
    }
  | { action: 'delete'; id: string; reason?: string }
  | { action: 'keep'; id: string; evidence?: ProposalEvidence };

const TOOL_NAME = 'submit_rule_proposals';

const SYSTEM_PROMPT =
  'Propões regras de organização do Gmail para um utilizador português, a partir dos emails dos ' +
  `últimos ${ANALYSIS_DAYS} dias que ainda não têm nenhum marcador dele. Recebes os remetentes desses ` +
  'emails com números, as regras que ele já tem, as propostas que ainda estão pendentes e as que ele ' +
  'rejeitou. Devolves as alterações às propostas com a ferramenta submit_rule_proposals.\n' +
  'O mais importante: as regras que ele já tem mostram como ele gosta de tratar cada tipo de email. ' +
  'Antes de propores, lê as ações de cada uma (markAsRead, removeFromInbox, removeFromInboxAfterDays, ' +
  'removeOnlyIfRead, markAsReadOnRemove, prazos da estrela e do importante, stopProcessing, ' +
  'marcadores) e percebe o padrão: o que marca como lido logo e o que só marca ao arquivar, quanto ' +
  'tempo deixa cada tipo na caixa, onde exige que já tenha lido. Para um email parecido com o de uma ' +
  'regra dele, usa a mesma combinação de ações, e diz no reason qual regra serviu de modelo. Só usas ' +
  'critério teu quando não houver nada parecido — e aí pensa no efeito real na caixa dele (por ' +
  'exemplo, marcar como lido logo e arquivar só dias depois não serve para nada: o email fica na ' +
  'caixa já lido).\n' +
  'Regras de decisão:\n' +
  '- Não proponhas o que uma regra existente já faz, nem nada parecido com uma proposta rejeitada.\n' +
  '- Cada proposta pendente: keep se continua certa, update se os números mudaram e a regra deve ' +
  'mudar ou se as ações não seguem o padrão das regras dele, delete se já não faz sentido (o ' +
  'remetente deixou de escrever, ou uma regra já o cobre). ' +
  'As editadas pelo utilizador (userEdited) são só para manter — não as alteres nem apagues.\n' +
  '- create para cada padrão que uma regra resolveria: um remetente ou domínio com 2 ou mais emails ' +
  'sem regra, ou uma expressão de assunto que se repete. Caixas pequenas também contam — com poucos ' +
  'emails, propõe na mesma o que for claro. Junta o mesmo domínio numa só regra. No máximo 8 ' +
  'propostas pendentes no total.\n' +
  '- comment: uma ou duas frases em português europeu a resumir o que decidiste e porquê — sobretudo ' +
  'quando não propões nada (ex: "os 19 emails vêm de 17 remetentes diferentes, nenhum se repete").\n' +
  '- Pensa em todas as ações, não só nos marcadores: marcar como lido, arquivar já ou ao fim de N ' +
  'dias (removeFromInboxAfterDays), só se lido (removeOnlyIfRead), marcar como lido ao arquivar, ' +
  'mailKind BULK para a publicidade quando o mesmo remetente também manda emails da conta, e tirar ' +
  'a estrela ou o importante ao fim de N dias — sempre pelo padrão das regras dele.\n' +
  '- Condições: usa os mesmos tipos que ele usa nas regras dele — remetente (fromContains), assunto ' +
  '(subjectContains), palavras-chave (keywords), palavras a excluir (excludeKeywords) e conditionLogic ' +
  'ALL/ANY. Se ele junta remetente e assunto, ou apanha um tipo de email por palavras-chave, faz ' +
  'igual. Quando o mesmo tipo de email vem de vários remetentes (códigos de verificação, faturas, ' +
  'recibos, entregas), prefere subjectContains/keywords com as expressões da lista "Assuntos que se ' +
  'repetem" a uma lista de remetentes; para um só remetente, o domínio (ex: "@revolut.com") chega, ' +
  'e acrescenta assunto ou excludeKeywords só para separar tipos de email desse remetente. Usa ' +
  'expressões específicas — nunca palavras soltas que também apareçam em publicidade.\n' +
  '- Nomes de regras e marcadores em português europeu, caminhos com barras (ex: "Bancos/Revolut").\n' +
  '- reason: uma ou duas frases em português europeu com os números (ex: "42 emails em 30 dias, 35 ' +
  'de publicidade, 30 por ler"). evidence: os totais e os remetentes que a regra apanha.';

const EVIDENCE_SCHEMA = {
  type: 'object',
  properties: {
    emails: { type: 'integer' },
    unread: { type: 'integer' },
    bulk: { type: 'integer' },
    senders: { type: 'array', items: { type: 'string' } },
  },
  required: ['emails', 'unread', 'bulk', 'senders'],
};

const TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description: 'Entrega a lista de alterações às regras propostas.',
  input_schema: {
    type: 'object',
    properties: {
      changes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['create', 'update', 'delete', 'keep'],
            },
            id: {
              type: 'string',
              description: 'Id da proposta (update, delete, keep).',
            },
            rule: {
              type: 'object',
              description: 'A regra completa (create, update).',
              properties: RULE_FIELDS_SCHEMA,
            },
            reason: { type: 'string' },
            evidence: EVIDENCE_SCHEMA,
          },
          required: ['action'],
        },
      },
      comment: {
        type: 'string',
        description:
          'Resumo curto do que decidiste e porquê, em português europeu.',
      },
    },
    required: ['changes', 'comment'],
  },
};

const describeSender = (sender: UnlabeledSummary['senders'][number]) =>
  `${sender.name} <${sender.address}>: ${sender.emails} emails, ${sender.unread} por ler, ` +
  `${sender.bulk} publicidade, ${sender.inInbox} na caixa de entrada` +
  `${sender.oldestInInboxDays != null ? ` (o mais antigo há ${sender.oldestInInboxDays} dias)` : ''}; ` +
  `ex.: ${sender.subjects.map((subject) => `"${subject}"`).join(' / ')}`;

/**
 * Pede ao Claude as alterações às regras propostas. Obriga-o a responder pela
 * ferramenta, por isso o resultado é sempre a lista estruturada — nunca texto
 * para interpretar.
 */
export async function requestRuleProposals(
  client: AiClient,
  input: {
    summary: UnlabeledSummary;
    /** As regras dele com todos os campos (condições e ações), para lhe copiar o estilo. */
    rules: Record<string, unknown>[];
    pending: ExistingProposal[];
    dismissed: Record<string, unknown>[];
  },
): Promise<{ changes: ProposalChange[]; comment: string | null }> {
  const { summary, rules, pending, dismissed } = input;
  const content = [
    `Emails dos últimos ${ANALYSIS_DAYS} dias: ${summary.read} lidos, ${summary.unlabeled} sem nenhum marcador.`,
    '',
    'Assuntos que se repetem nos emails sem marcador (expressão: emails, remetentes diferentes, exemplo):',
    ...(summary.subjectPhrases.length
      ? summary.subjectPhrases.map(
          (entry) =>
            `- "${entry.phrase}": ${entry.emails} emails de ${entry.senders} remetentes; ex.: "${entry.example}"`,
        )
      : ['- nenhum']),
    '',
    'Remetentes dos emails sem marcador:',
    ...(summary.senders.length
      ? summary.senders.map((sender) => `- ${describeSender(sender)}`)
      : ['- nenhum']),
    '',
    'Regras que o utilizador já tem, com todas as ações (JSON) — é daqui que tiras o estilo dele:',
    rules.length ? JSON.stringify(rules) : 'nenhuma',
    '',
    'Propostas pendentes (JSON):',
    JSON.stringify(pending),
    '',
    'Propostas rejeitadas — não voltes a propor nada parecido (JSON):',
    JSON.stringify(dismissed),
  ].join('\n');

  const response = await client.messages.create({
    model: SUBAGENT_MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    tools: [TOOL],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [{ role: 'user', content }],
  });

  const call = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
  );
  const submitted = call?.input as
    { changes?: ProposalChange[]; comment?: string } | undefined;
  return {
    changes: Array.isArray(submitted?.changes) ? submitted.changes : [],
    comment: typeof submitted?.comment === 'string' ? submitted.comment : null,
  };
}
