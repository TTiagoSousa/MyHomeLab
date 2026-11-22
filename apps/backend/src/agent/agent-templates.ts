import { AgentEffort, AgentModel } from 'src/generated/prisma/client/client';
import { CEO_PROMPT } from 'src/assistant/agents/prompts/ceo.prompt';
import { ADMIN_PROMPT } from 'src/assistant/agents/prompts/admin.prompt';
import { INFRA_PROMPT } from 'src/assistant/agents/prompts/infra.prompt';
import { DOCTOR_PROMPT } from 'src/assistant/agents/prompts/doctor.prompt';
import { HEALTH_DATA_PROMPT } from 'src/assistant/agents/prompts/health-data.prompt';
import { TRAINER_PROMPT } from 'src/assistant/agents/prompts/trainer.prompt';
import { TRAVEL_PROMPT } from 'src/assistant/agents/prompts/travel.prompt';
import { GAMES_PROMPT } from 'src/assistant/agents/prompts/games.prompt';
import { PHOTOS_PROMPT } from 'src/assistant/agents/prompts/photos.prompt';
import { ARCHIVIST_PROMPT } from 'src/assistant/agents/prompts/archivist.prompt';
import { TIMEKEEPER_PROMPT } from 'src/assistant/agents/prompts/timekeeper.prompt';
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
  'docs_layout',
  'docs_targets',
  'docs_propose',
  'docs_write',
  'docs_log',
];

/**
 * Os agentes do site. Uma instalação nova começa só com o CEO; os outros criam-se a
 * partir daqui (create_agent com template, ou POST /agents com template) e, tal como os
 * que já existem com este template, apontam para as instruções daqui enquanto não as
 * editar, para receber as melhorias do site.
 */
const TEMPLATES: AgentTemplate[] = [
  {
    key: 'ceo',
    name: 'Jarvis',
    description:
      'O CEO: fala contigo no site e na app, passa cada pedido a quem da equipa o deve tratar e junta os relatórios na resposta.',
    prompt: CEO_PROMPT,
    model: 'OPUS',
    effort: 'MEDIUM',
    tools: toolsOf(
      'team',
      'docs',
      'schedules',
      'board',
      'todos',
      'drive',
      'plane',
      'dispatcharr',
      'jellyfin',
    ),
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
      'Vigia, estuda e mantém os servidores (Proxmox, serviços e alertas, discos e backups), estuda e faz as atualizações das apps com a tua aprovação, corre comandos, mantém o mapa de cada servidor e trata do AdGuard (DNS), do Nextcloud e do Forgejo (código e CI).',
    prompt: INFRA_PROMPT,
    model: 'SONNET',
    effort: 'LOW',
    tools: [
      ...toolsOf(
        'servers',
        'backups',
        'forgejo',
        'giteaMirror',
        'infisical',
        'vaultwarden',
        'postgres',
        'clickhouse',
        'nginxProxyManager',
        'tplinkRouter',
        'coolify',
        'adguard',
        'nextcloud',
        'serverShell',
        'docs',
        'updates',
        'schedules',
        'board',
        'todos',
        // Decidir as propostas de documentos é do CEO, com o sim dele.
      ).filter((tool) => tool !== 'docs_decide'),
      // As atualizações do Home Assistant (ler e instalar), sem o controlo da casa.
      'ha_overview',
      'ha_list_updates',
      'ha_list_entities',
      'ha_get_entity',
      'ha_list_configs',
      'ha_system_log',
      'ha_update_install',
      'disk_alert_get',
      'disk_alert_save_study',
      'disk_alert_grow',
      'disk_alert_ask',
      'disk_alert_done',
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
      // Os avisos de disco são do Engenheiro (vê por SSH o que ocupa o espaço).
      ...toolsOf('serverControl').filter(
        (tool) => !tool.startsWith('disk_alert_'),
      ),
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
  {
    key: 'games',
    name: 'Curador de Jogos',
    description:
      'A prateleira de jogos no GamesTracker: o que joga, acabou e quer jogar, horas, notas, recomendações e alertas de preço.',
    prompt: GAMES_PROMPT,
    model: 'SONNET',
    effort: 'LOW',
    tools: [...toolsOf('gametracker'), ...DOCS_READ],
    reportsTo: 'ceo',
    color: 8,
    legacyKeys: [],
  },
  {
    key: 'photos',
    name: 'Curador de Fotos',
    description:
      'As fotos e os vídeos no Immich: encontrar fotos, arrumar álbuns, dar nome às pessoas e cuidar das definições, das tarefas e dos backups do servidor.',
    prompt: PHOTOS_PROMPT,
    model: 'SONNET',
    effort: 'LOW',
    tools: [...toolsOf('immich'), ...DOCS_READ],
    reportsTo: 'ceo',
    color: 6,
    legacyKeys: [],
  },
  {
    key: 'archivist',
    name: 'Arquivista',
    description:
      'Os documentos digitalizados no Paperless: encontrar e ler faturas, contratos e recibos, arrumá-los (etiquetas, correspondentes, tipos), tratar os PDFs no Stirling-PDF (comprimir, OCR, juntar, dividir, converter…) e cuidar da configuração e das tarefas do servidor.',
    prompt: ARCHIVIST_PROMPT,
    model: 'SONNET',
    effort: 'LOW',
    tools: [...toolsOf('paperless', 'stirling', 'drive'), ...DOCS_READ],
    reportsTo: 'ceo',
    color: 2,
    legacyKeys: [],
  },
  {
    key: 'timekeeper',
    name: 'Gestor de Horas',
    description:
      'As horas no solidtime: pôr e parar o cronómetro, registar horas esquecidas, ver e somar as horas por projeto, cliente ou dia, e arrumar projetos, clientes, tarefas e etiquetas.',
    prompt: TIMEKEEPER_PROMPT,
    model: 'SONNET',
    effort: 'LOW',
    tools: [...toolsOf('solidtime'), ...DOCS_READ],
    reportsTo: 'ceo',
    color: 4,
    legacyKeys: [],
  },
];

/** Os ficheiros que ele manda no chat: toda a equipa os pode ler e fazer contas com eles. */
const CHAT_FILES = toolsOf('chatFiles');

export const AGENT_TEMPLATES: AgentTemplate[] = TEMPLATES.map((template) => ({
  ...template,
  tools: [...template.tools, ...CHAT_FILES],
}));

export const templatePrompt = (template: string | null) =>
  AGENT_TEMPLATES.find((entry) => entry.key === template)?.prompt ?? null;
