import type { AiClient } from 'src/ai-credential/ai-client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { PrismaEmailRuleRepository } from 'src/email-rule/repositories/prisma/prisma-email-rule-repository';
import { PrismaAgentRepository } from 'src/agent/repositories/prisma/prisma-agent-repository';
import { Agent } from 'src/generated/prisma/client/client';
import { AgentActivityService } from 'src/agent-activity/agent-activity.service';
import { AgentPromptProposalService } from 'src/agent/agent-prompt-proposal.service';
import { ServerConnectionService } from 'src/server-connection/server-connection.service';
import { ServerCommandService } from 'src/server-connection/server-command.service';
import { ServiceMonitorService } from 'src/service-monitor/service-monitor.service';
import { DiskHealthService } from 'src/disk-health/disk-health.service';
import { DiskAlertService } from 'src/disk-alert/disk-alert.service';
import { NotificationService } from 'src/notification/notification.service';
import { BackupService } from 'src/backup/backup.service';
import { HealthServices } from '../tools/healthTools';
import { EmailRuleProposalService } from 'src/email-rule-proposal/email-rule-proposal.service';
import { DocsService } from 'src/docs/docs.service';
import { ProjectsService } from 'src/docs/projects.service';
import { BoardService } from 'src/board/board.service';
import { AccessTarget } from 'src/agent/helpers/appAccess';
import type { ModelUsage } from 'src/ai-credential/ai-usage.service';
import { AppUpdateService } from 'src/app-update/app-update.service';
import { AgentScheduleService } from 'src/agent-schedule/agent-schedule.service';
import { TodoService } from 'src/todo/todo.service';

/**
 * O que qualquer agente precisa de ter à mão. Passa-se um objeto só em vez de uma lista
 * de argumentos que cresce sempre que um agente ganha uma capacidade nova.
 */
export interface AgentContext {
  /** Quem está a falar. As ferramentas só veem as contas e as regras desta pessoa. */
  userId: string;

  /** Testar URLs da rede de casa (check_service_status) é só para administradores. */
  isAdmin: boolean;

  /** O que o utilizador não deixa o Jarvis fazer ("health.write", …). */
  deniedPermissions: string[];

  /** Cliente com a chave de IA deste utilizador. */
  ai: AiClient;

  connectedAccountRepository: PrismaConnectedAccountRepository;
  emailRuleRepository: PrismaEmailRuleRepository;
  agentRepository: PrismaAgentRepository;

  /** A equipa de agentes do utilizador, lida uma vez por volta de conversa. */
  team: Agent[];

  activity: AgentActivityService;
  promptProposals: AgentPromptProposalService;

  /** As regras propostas do Gmail (análise, aceitar, recusar). */
  emailProposals: EmailRuleProposalService;

  /** Os servidores Proxmox deste utilizador (Apps ligadas → Proxmox). */
  serverConnections: ServerConnectionService;
  /** Os comandos por SSH (nível 2). */
  serverCommands: ServerCommandService;

  /** Os serviços vigiados e as notificações. */
  serviceMonitors: ServiceMonitorService;
  /** A saúde dos discos dos servidores Proxmox. */
  diskHealth: DiskHealthService;
  /** Os avisos de disco quase cheio dos CTs e VMs (cron job do servidor). */
  diskAlerts: DiskAlertService;
  notifications: NotificationService;
  /** Os backups automáticos das apps ligadas e os destinos. */
  backups: BackupService;

  /** Os documentos do utilizador (regras, checklists, notas, aprendizagens, guias). */
  docs: DocsService;
  /** Os projetos (a empresa, uma página…) a que se ligam documentos. */
  projects: ProjectsService;
  /** As atualizações das apps ligadas (estudo, checklist, aprovação). */
  updates: AppUpdateService;
  /** Os trabalhos agendados dos agentes (Projetos → Disparos). */
  schedules: AgentScheduleService;
  /** O quadro de tarefas (Projetos). */
  board: BoardService;
  /** As tarefas do utilizador (os afazeres, em Tarefas). */
  todos: TodoService;
  /** As apps e servidores com o que cada agente pode (a página da app → Agentes). */
  appAccess: () => Promise<AccessTarget[]>;

  /** Quem quer saber os tokens gastos (um agendamento); passa para os subagentes. */
  onUsage?: (usage: ModelUsage) => void;
  /** Os documentos que os agentes usaram nesta volta (os obrigatórios do pedido e os lidos). */
  docsUsed?: Map<string, string>;
  /**
   * O que a equipa fez nesta volta (agente: ação e o pormenor). Fica gravado com a
   * resposta e volta no histórico, para o Jarvis saber na volta seguinte o que já
   * foi lido ou feito (ele só vê o texto das respostas, não as ferramentas).
   */
  actionsDone?: string[];
  /** Fica no consumo da IA (por agente e origem: conversa, disparo, estudo…). */
  recordUsage?: (agentKey: string, usage: ModelUsage) => void;

  /** O agente que está a correr (cada um recebe a sua cópia do contexto). */
  agentKey?: string;

  /**
   * De onde vem esta volta: "chat" (ele escreveu agora) ou um disparo (study,
   * install, verify, schedule). Só no chat é ele a falar.
   */
  source?: string;

  /** Os dados de saúde importados do Huawei Health (só leitura). */
  health: HealthServices;

  /**
   * Identifica esta volta de conversa — uma mensagem do utilizador e a resposta que
   * lhe corresponde. É o que impede o agente de propor uma alteração de prompt
   * e aplicá-la a si próprio sem passar por ele: as duas coisas não podem
   * acontecer com o mesmo turnId.
   */
  turnId: string;
}
