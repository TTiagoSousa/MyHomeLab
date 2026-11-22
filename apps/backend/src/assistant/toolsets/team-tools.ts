import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  listAgentPrompts,
  proposeAgentPrompt,
  applyAgentPrompt,
  discardAgentPrompt,
} from '../tools/manageAgentPrompts';
import {
  listAvailableTools,
  listTeam,
  planAgentChange,
} from '../tools/manageTeam';
import type { AgentChangePayload } from 'src/chat-approval/chat-approval.types';

const AGENT = {
  type: 'string' as const,
  description: 'A chave ou o nome do agente (ex.: "smarthome").',
};

const MODEL = {
  type: 'string' as const,
  enum: ['SONNET', 'OPUS'],
  description:
    'SONNET para quase tudo (rápido e barato); OPUS só para raciocínio pesado.',
};

const EFFORT = {
  type: 'string' as const,
  enum: ['LOW', 'MEDIUM', 'HIGH'],
  description:
    'Quanto pensa antes de responder: LOW para consultas, MEDIUM para análise e configuração, HIGH raramente.',
};

const TOOLS_HINT =
  'Nomes de ferramentas ou de grupos inteiros (ex.: "homeAssistant", "email", "health"), como em list_available_tools.';

const tools = (description: string) => ({
  type: 'array' as const,
  items: { type: 'string' as const },
  description: `${description}${TOOLS_HINT}`,
});

/**
 * O governo da equipa: ver os agentes e as ferramentas, criar, mudar e apagar
 * agentes, e as instruções extra (propor, aplicar depois do sim, descartar).
 */
export function buildTeamTools(context: AgentContext): AgentTool[] {
  return [
    {
      name: 'list_team',
      description:
        'Mostra a equipa: chave, nome, a quem responde, modelo, esforço, o que faz e as ferramentas de cada agente.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => Promise.resolve(listTeam(context)),
    },
    {
      name: 'list_available_tools',
      description:
        'Todas as ferramentas que um agente pode receber, por grupo, e se leem ou alteram. Vê aqui antes de criar ou mudar um agente.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => Promise.resolve(listAvailableTools()),
    },
    {
      name: 'create_agent',
      description:
        'Propõe um agente novo na equipa, já com tudo: nome, descrição, instruções completas, modelo, esforço, ferramentas e a quem responde (por omissão, a ti). Não cria logo: aparece-lhe um cartão no chat e só fica criado quando ele aprova.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Ex.: "Gestor Financeiro".' },
          description: {
            type: 'string',
            description:
              'Uma ou duas frases do que faz e quando lhe passar trabalho: é o que o chefe lê para decidir delegar.',
          },
          prompt: {
            type: 'string',
            description:
              'As instruções completas, em português europeu, no estilo das da equipa: quem é e o que faz; uma secção por área com as ferramentas que usa e como; o formato do relatório; e CUIDADOS (o que confirma antes de alterar, o que nunca faz).',
          },
          model: MODEL,
          effort: EFFORT,
          tools: tools(''),
          reports_to: {
            type: 'string',
            description:
              'A chave ou o nome do chefe. Omite para responder a ti.',
          },
        },
        required: ['name', 'description', 'prompt', 'tools'],
      },
      handler: (input: Record<string, unknown>) =>
        proposeChange('create', input, context),
    },
    {
      name: 'update_agent',
      description:
        'Propõe uma mudança a um agente da equipa (menos tu): nome, descrição, instruções, modelo, esforço, ferramentas (todas, ou só acrescentar/tirar), a quem responde, ou liga/desliga. Só muda o que passares, e só quando ele aprova o cartão no chat.',
      inputSchema: {
        type: 'object',
        properties: {
          agent: AGENT,
          name: { type: 'string' },
          description: { type: 'string' },
          prompt: {
            type: 'string',
            description:
              'Substitui as instruções principais TODAS. Nos agentes do site, vazio volta às do site. Para acrescentos pequenos usa antes as instruções extra (propose_agent_prompt).',
          },
          model: MODEL,
          effort: EFFORT,
          tools: tools('Substitui a lista toda. '),
          add_tools: tools('Acrescenta. '),
          remove_tools: tools('Tira. '),
          reports_to: {
            type: 'string',
            description: 'A chave ou o nome do novo chefe.',
          },
          active: {
            type: 'boolean',
            description: 'false desliga o agente sem o apagar.',
          },
        },
        required: ['agent'],
      },
      handler: (input: Record<string, unknown>) =>
        proposeChange('update', input, context),
    },
    {
      name: 'delete_agent',
      description:
        'Propõe apagar um agente da equipa (não o CEO). Quem lhe respondia passa a responder ao chefe dele. Fica apagado quando ele aprova o cartão no chat.',
      inputSchema: {
        type: 'object',
        properties: { agent: AGENT },
        required: ['agent'],
      },
      handler: (input: Record<string, unknown>) =>
        proposeChange('delete', input, context),
    },
    {
      name: 'approval_decide',
      description:
        'Aprova ou recusa um cartão do chat (enviar um email, mudar a equipa, instalar uma atualização) quando ele o diz numa mensagem nova ("aprovo", "envia", "não"). Só no chat, para um cartão desta conversa feito numa resposta anterior; nunca por iniciativa tua.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description:
              'O id do cartão (vem na lista dos que estão por decidir).',
          },
          decision: { type: 'string', enum: ['approve', 'reject'] },
        },
        required: ['id', 'decision'],
      },
      handler: (input: { id: string; decision: 'approve' | 'reject' }) =>
        context.approvals.decideFromChat(
          context.userId,
          input.id,
          input.decision,
          context,
        ),
    },
    {
      name: 'list_agent_prompts',
      description:
        'Mostra os agentes da equipa (com a chave de cada um) e as instruções extra que ' +
        'cada um tem neste momento, mais as propostas de alteração ainda por autorizar. ' +
        'Só lê, não muda nada.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => Promise.resolve(listAgentPrompts(context)),
    },
    {
      name: 'propose_agent_prompt',
      description:
        'Regista uma proposta de alteração às instruções extra de um agente da equipa e ' +
        'devolve um código. NÃO altera nada — serve para apresentares a mudança ao utilizador e ' +
        'pedires autorização. A alteração só acontece com apply_agent_prompt, depois de ele ' +
        'concordar.',
      inputSchema: {
        type: 'object',
        properties: {
          agent_key: {
            type: 'string',
            description:
              'A chave do agente, como aparece em list_agent_prompts (a tua é a do CEO: aí ficam o tom e o estilo das respostas).',
          },
          new_prompt: {
            type: ['string', 'null'],
            description:
              'As instruções extra completas que passam a valer, já escritas por ti na forma ' +
              'final. Não é um acrescento ao que lá está: substitui. Usa null para apagar ' +
              'as instruções extra e devolver o agente ao comportamento de origem.',
          },
        },
        required: ['agent_key', 'new_prompt'],
      },
      handler: async (input: {
        agent_key: string;
        new_prompt: string | null;
      }) => Promise.resolve(proposeAgentPrompt(input, context)),
    },
    {
      name: 'apply_agent_prompt',
      description:
        'Aplica uma proposta que o utilizador já autorizou. Só funciona numa mensagem posterior ' +
        'àquela em que a proposta foi criada — se a chamares na mesma resposta, é recusada.',
      inputSchema: {
        type: 'object',
        properties: {
          proposal_id: {
            type: 'string',
            description:
              'O código devolvido pelo propose_agent_prompt. Se o tiveres perdido, deixa em branco e usa o agent_key.',
          },
          agent_key: {
            type: 'string',
            description:
              'Alternativa ao código: a chave do agente cuja proposta em aberto se aplica.',
          },
        },
      },
      handler: async (input: { proposal_id?: string; agent_key?: string }) =>
        applyAgentPrompt(input, context),
    },
    {
      name: 'discard_agent_prompt',
      description:
        'Deita fora uma proposta por aplicar, quando o utilizador recusa ou muda de ideias.',
      inputSchema: {
        type: 'object',
        properties: {
          proposal_id: {
            type: 'string',
            description: 'O código da proposta a descartar.',
          },
        },
        required: ['proposal_id'],
      },
      handler: async (input: { proposal_id: string }) =>
        Promise.resolve(discardAgentPrompt(input, context)),
    },
  ];
}

/** create_agent, update_agent e delete_agent: um cartão no chat, que ele aprova. */
async function proposeChange(
  action: AgentChangePayload['action'],
  input: Record<string, unknown>,
  context: AgentContext,
): Promise<string> {
  if (context.source !== 'chat' || !context.conversationId) {
    return 'Recusado: mudar a equipa só se faz no chat, com o sim dele num cartão. Diz-lhe o que propões no aviso.';
  }
  const plan = planAgentChange(action, input, context);
  if (typeof plan === 'string') return plan;
  const approval = await context.approvals.create(
    context.userId,
    'AGENT_CHANGE',
    context.agentKey ?? 'ceo',
    plan,
    { conversationId: context.conversationId, turnId: context.turnId },
    (payload) =>
      (payload as unknown as AgentChangePayload).agentName === plan.agentName,
  );
  return (
    `Proposta registada (${approval.id}): aparece-lhe um cartão no chat com o que muda, e só acontece quando ele carrega em Aprovar. ` +
    'Diz-lhe numa frase o que propões. Se ele responder que aprova numa mensagem nova, o Jarvis decide com approval_decide.'
  );
}
