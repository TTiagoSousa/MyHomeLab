import { AgentEffort, AgentModel } from 'src/generated/prisma/client/client';
import { CEO_PROMPT } from 'src/assistant/agents/prompts/ceo.prompt';
import { ADMIN_PROMPT } from 'src/assistant/agents/prompts/admin.prompt';
import { INFRA_PROMPT } from 'src/assistant/agents/prompts/infra.prompt';
import { DOCTOR_PROMPT } from 'src/assistant/agents/prompts/doctor.prompt';
import { HEALTH_DATA_PROMPT } from 'src/assistant/agents/prompts/health-data.prompt';
import { TRAINER_PROMPT } from 'src/assistant/agents/prompts/trainer.prompt';
import { TRAVEL_PROMPT } from 'src/assistant/agents/prompts/travel.prompt';
import { SMARTHOME_PROMPT } from 'src/assistant/agents/prompts/smarthome.prompt';
import { PROXMOX_OPERATOR_PROMPT } from 'src/assistant/agents/prompts/proxmox-operator.prompt';
import { TOOL_CATALOG, ToolGroup } from './tool-catalog';

export interface AgentTemplate {
  key: string;
  name: string;
  description: string;
  prompt: string;
  model: AgentModel;
  effort: AgentEffort;
  tools: string[];
  /** A chave do template a quem responde; null = o de topo. */
  reportsTo: string | null;
  color: number;
  /** As chaves dos agentes antigos cujas instruções extra passam para este. */
  legacyKeys: string[];
}

const toolsOf = (...groups: ToolGroup[]) =>
  TOOL_CATALOG.filter((entry) => groups.includes(entry.group)).map(
    (entry) => entry.name,
  );

/**
 * Os documentos para todos: ler e propor nos do utilizador (as regras valem para
 * todos) e escrever os seus (um estudo, notas, o registo do que fizeram).
 */
const DOCS_READ = [
  'docs_search',
  'docs_read',
  'docs_projects',
  'docs_propose',
  'docs_write',
  'docs_log',
];

/**
 * Os agentes do site. Uma instalação nova começa só com o CEO; os outros ficam aqui
 * para os agentes que já existem com este template, que continuam a apontar para as
 * instruções daqui enquanto não as editar, para receber as melhorias do site.
 */
export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    key: 'ceo',
    name: 'Jarvis',
    description:
      'O CEO: fala contigo no site e na app, passa cada pedido a quem da equipa o deve tratar e junta os relatórios na resposta.',
    prompt: CEO_PROMPT,
    model: 'OPUS',
    effort: 'MEDIUM',
    tools: toolsOf('team', 'docs', 'schedules', 'board', 'todos'),
    reportsTo: null,
    color: 1,
    legacyKeys: ['main'],
  },
  {
    key: 'admin',
    name: 'Assistente Administrativo',
    description:
      'Trata dos emails (pesquisa, resumos e regras do Gmail, sempre a respeitar as tuas regras) e das tuas tarefas (a página Tarefas).',
    prompt: ADMIN_PROMPT,
    model: 'SONNET',
    effort: 'LOW',
    tools: [...toolsOf('email', 'emailRules', 'board', 'todos'), ...DOCS_READ],
    reportsTo: 'ceo',
    color: 2,
    legacyKeys: ['email', 'tasks'],
  },
  {
    key: 'infra',
    name: 'Engenheiro de Infraestrutura',
    description:
      'Vigia, estuda e mantém os servidores (Proxmox, serviços e alertas, discos e backups), estuda e faz as atualizações das apps com a tua aprovação, corre comandos, escreve o guia de cada servidor e trata do AdGuard (DNS), do Nextcloud e do Forgejo (código e CI).',
    prompt: INFRA_PROMPT,
    model: 'SONNET',
    effort: 'LOW',
    tools: [
      ...toolsOf(
        'servers',
        'backups',
        'forgejo',
        'adguard',
        'nextcloud',
        'serverShell',
        'docs',
        'updates',
        'schedules',
        'board',
        'todos',
      ),
      'ha_list_updates',
    ],
    reportsTo: 'ceo',
    color: 3,
    legacyKeys: ['server'],
  },
  {
    key: 'proxmox',
    name: 'Operador Proxmox',
    description:
      'Mexe nas máquinas do Proxmox pela API: liga, desliga e reinicia VMs e CTs, snapshots, backups e recursos (CPU, RAM, disco).',
    prompt: PROXMOX_OPERATOR_PROMPT,
    model: 'SONNET',
    effort: 'LOW',
    tools: [
      'list_servers',
      'list_proxmox_guests',
      'get_guest_status',
      ...toolsOf('serverControl'),
      ...DOCS_READ,
    ],
    reportsTo: 'infra',
    color: 8,
    legacyKeys: [],
  },
  {
    key: 'smarthome',
    name: 'Engenheiro de Smart Home',
    description:
      'Trata da casa no Home Assistant: vê e controla dispositivos (luzes, clima, estores, cenas), organiza entidades e áreas, e cria, afina ou apaga automações, scripts e cenas.',
    prompt: SMARTHOME_PROMPT,
    model: 'SONNET',
    effort: 'MEDIUM',
    tools: [...toolsOf('homeAssistant'), ...DOCS_READ],
    reportsTo: 'ceo',
    color: 7,
    legacyKeys: [],
  },
  {
    key: 'doctor',
    name: 'Médico pessoal',
    description:
      'Interpreta a tua saúde e dá conselhos. Pede os dados ao Cientista de Dados de Saúde.',
    prompt: DOCTOR_PROMPT,
    model: 'SONNET',
    effort: 'MEDIUM',
    tools: DOCS_READ,
    reportsTo: 'ceo',
    color: 4,
    legacyKeys: ['health'],
  },
  {
    key: 'health-data',
    name: 'Cientista de Dados de Saúde',
    description:
      'Lê, cruza e regista os dados de saúde: sono, batimento, treinos, alimentação, corpo, análises e medicação.',
    prompt: HEALTH_DATA_PROMPT,
    model: 'SONNET',
    effort: 'LOW',
    tools: [...toolsOf('health'), ...DOCS_READ],
    reportsTo: 'doctor',
    color: 5,
    legacyKeys: [],
  },
  {
    key: 'trainer',
    name: 'Personal Trainer',
    description:
      'Treino e desporto em geral: avalia os treinos, faz planos e rotinas, vê a recuperação e regista treinos.',
    prompt: TRAINER_PROMPT,
    model: 'SONNET',
    effort: 'MEDIUM',
    tools: [
      'health_overview',
      'health_metric',
      'health_detail',
      'health_log',
      ...toolsOf('opengym'),
      ...DOCS_READ,
    ],
    reportsTo: 'doctor',
    color: 6,
    legacyKeys: [],
  },
  {
    key: 'travel',
    name: 'Agente de Viagens',
    description:
      'Planeia viagens e põe-nas no TREK: lugares no mapa por ordem e com hora, trajetos de carro ou a pé, alojamento, transportes e o tempo.',
    prompt: TRAVEL_PROMPT,
    model: 'SONNET',
    effort: 'MEDIUM',
    tools: [...toolsOf('trek'), ...DOCS_READ],
    reportsTo: 'ceo',
    color: 7,
    legacyKeys: [],
  },
];

export const templatePrompt = (template: string | null) =>
  AGENT_TEMPLATES.find((entry) => entry.key === template)?.prompt ?? null;
