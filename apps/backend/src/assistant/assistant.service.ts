import { randomUUID } from 'crypto';
import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AiClient } from 'src/ai-credential/ai-client';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { PrismaEmailRuleRepository } from 'src/email-rule/repositories/prisma/prisma-email-rule-repository';
import { PrismaAgentSettingRepository } from 'src/agent/repositories/prisma/prisma-agent-setting-repository';
import { AgentActivityService } from 'src/agent-activity/agent-activity.service';
import { AgentPromptProposalService } from 'src/agent/agent-prompt-proposal.service';
import { ServerConnectionService } from 'src/server-connection/server-connection.service';
import { ServerCommandService } from 'src/server-connection/server-command.service';
import { ServiceMonitorService } from 'src/service-monitor/service-monitor.service';
import { BackupService } from 'src/backup/backup.service';
import { DiskHealthService } from 'src/disk-health/disk-health.service';
import { DiskAlertService } from 'src/disk-alert/disk-alert.service';
import { NotificationService } from 'src/notification/notification.service';
import { AgentContext } from './agents/agent-context';
import { ChatRole } from 'src/generated/prisma/client/client';
import { AiCredentialService } from 'src/ai-credential/ai-credential.service';
import { HealthService } from 'src/health/health.service';
import { HeartRateService } from 'src/health/heart-rate.service';
import { SkinTemperatureService } from 'src/health/skin-temperature.service';
import { BloodOxygenService } from 'src/health/blood-oxygen.service';
import { StressService } from 'src/health/stress.service';
import { StepsService } from 'src/health/steps.service';
import { ExerciseService } from 'src/health/exercise.service';
import { WeightService } from 'src/health/weight.service';
import { WaterService } from 'src/health/water.service';
import { LabsService } from 'src/health/labs.service';
import { HealthRecordsService } from 'src/health/health-records.service';
import { NutritionService } from 'src/health/nutrition.service';
import { BodyService } from 'src/health/body.service';
import { WellbeingService } from 'src/health/wellbeing.service';
import { MedicalService } from 'src/health/medical.service';
import { IntakesService } from 'src/health/intakes.service';
import { EmailRuleProposalService } from 'src/email-rule-proposal/email-rule-proposal.service';
import { aiFailure } from 'src/ai-credential/ai-providers';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { runAgent } from './claude-agent.client';
import {
  appendCustomPrompt,
  docsSection,
} from 'src/agent/helpers/composeSystemPrompt';
import { guardTools } from 'src/agent/helpers/assistantToolPermissions';
import { ChatApprovalService } from 'src/chat-approval/chat-approval.service';
import {
  BRIDGE_PREFIX,
  BRIDGE_SERVER,
  openBridge,
} from 'src/claude-code/mcpBridge';
import { buildToolbox } from './toolsets/toolbox';
import { trekDirect } from './agents/trekDirect';
import { PrismaAgentRepository } from 'src/agent/repositories/prisma/prisma-agent-repository';
import { ensureTeam } from 'src/agent/helpers/ensureTeam';
import { templatePrompt } from 'src/agent/agent-templates';
import { Agent } from 'src/generated/prisma/client/client';
import { describePendingProposals } from './tools/manageAgentPrompts';
import { runTeamAgent } from './agents/team-agent';
import { DocsService } from 'src/docs/docs.service';
import { ProjectsService } from 'src/docs/projects.service';
import { TodoService } from 'src/todo/todo.service';
import { BoardService } from 'src/board/board.service';
import { AgentAccessService } from 'src/agent/agent-access.service';
import { AiUsageService } from 'src/ai-credential/ai-usage.service';
import { AccessTarget } from 'src/agent/helpers/appAccess';
import { AppUpdateService } from 'src/app-update/app-update.service';
import { AgentScheduleService } from 'src/agent-schedule/agent-schedule.service';
import { describeWhen } from 'src/agent-schedule/helpers/nextRunAt';
import { AgentSchedule } from 'src/generated/prisma/client/client';
import { targetLabel } from 'src/app-update/helpers/updateFields';
import { watchedInstalls } from 'src/app-update/helpers/installRetry';
import {
  ChatFileInfo,
  ChatFileService,
  UploadedChatFile,
  fileLine,
} from 'src/chat-file/chat-file.service';
import { DriveService } from 'src/google-drive/drive.service';

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
  /** Os documentos que os agentes usaram nesta resposta. */
  docsUsed?: { id: string; title: string }[];
  /** O que a equipa fez para esta resposta (vai no histórico para o modelo). */
  actions?: string[];
  /** Os ficheiros que ele mandou com esta mensagem. */
  files?: ChatFileInfo[];
}

/** O nome de um ficheiro como o browser o mandou (o multer lê-o em latin1). */
const uploadName = (file: UploadedChatFile) =>
  Buffer.from(file.originalname, 'latin1').toString('utf8');

// Quantas falas anteriores vão como contexto para o modelo. O histórico completo
// fica na base de dados; isto é só a janela que a conversa arrasta consigo.
const CONTEXT_MESSAGES = 20;

/** Como o histórico marca o que a equipa fez numa resposta (não é para o modelo repetir). */
const ACTIONS_NOTE =
  '[Nota interna do histórico, nunca a escrevas numa resposta — a equipa fez:';

/** Tira de uma resposta as notas do histórico que o modelo tenha copiado. */
export const stripActionsNote = (text: string) =>
  text
    .replace(
      /\n*\[(?:Para esta resposta a equipa fez|Nota interna do histórico)[^\]]*\]\s*/g,
      '',
    )
    .trim();

const DEFAULT_TITLE = 'Nova conversa';

/** Onde vai uma mensagem: uma conversa escolhida, uma nova, ou (omissão) a mais recente. */
export interface ConversationTarget {
  conversationId?: string;
  newConversation?: boolean;
}

/** O título de uma conversa nova: o começo da primeira mensagem, cortado numa palavra. */
function titleFrom(message: string): string {
  const text = message.replace(/\s+/g, ' ').trim();
  if (text.length <= 60) return text || DEFAULT_TITLE;
  const cut = text.slice(0, 60);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 30 ? cut.lastIndexOf(' ') : 60)}…`;
}

/**
 * O assistente propriamente dito: o agente principal, as suas ferramentas e o
 * histórico da conversa. A página do assistente é a porta de entrada.
 *
 * Tudo é de cada utilizador: a conversa, a chave de IA que paga as chamadas, as
 * contas e regras que as ferramentas veem, e as instruções dos subagentes.
 */
/** O pedido de um agendamento: ninguém está a acompanhar, e o aviso vai numa linha "AVISO:". */
const scheduledRequest = (schedule: AgentSchedule) =>
  [
    `[Agendamento "${schedule.title}" · ${describeWhen(schedule)} · criado por ${schedule.createdBy === 'user' ? 'ele' : schedule.createdBy}]`,
    'Estás a correr sozinho: ele não está a acompanhar e não pode responder agora. Segue os documentos — o "Quando corro sem ti", se existir, diz o que podes fazer sem ele (sem ele, faz só o que não muda nada); o que precisar dele fica para depois e diz-lho no aviso.',
    schedule.linkType && schedule.targetId
      ? `Ligado a: ${schedule.targetLabel ?? schedule.targetId} (${schedule.linkType} ${schedule.targetId}).`
      : null,
    '',
    'O que fazer:',
    schedule.instruction,
    '',
    'No fim, responde com um resumo curto do que fizeste e do que viste. Se houver algo que ele precise de saber ou decidir, acaba com uma linha a começar por "AVISO:" e o essencial numa ou duas frases; sem novidades, não ponhas essa linha.',
  ]
    .filter((line) => line !== null)
    .join('\n');

/** Os documentos usados numa volta, para guardar com a resposta. */
const docsList = (docs: Map<string, string> | undefined) =>
  docs?.size
    ? [...docs.entries()].map(([id, title]) => ({ id, title }))
    : undefined;

/** O terminal: só os documentos e o TREK a ler (o resto fica para o Jarvis). */
const TERMINAL_AGENT = 'terminal';
const TERMINAL_TOOLS = [
  'docs_search',
  'docs_read',
  'docs_projects',
  'docs_propose',
  'trek_overview',
];
const TERMINAL_SESSION_MS = 12 * 60 * 60_000;
const TERMINAL_PROMPT = `És o assistente do MyHomeLab, o painel do home lab do utilizador, a falar com ele no terminal. Respondes em português europeu, direto e conversacional.

COMO TRABALHAS
- Os documentos do MyHomeLab mandam. Antes de responderes sobre a casa, os servidores, as apps, a saúde ou as viagens, procura-os (docs_search) e lê os que o pedido toca (docs_read); segue-os à letra e diz qual usaste.
- Não mudas nada no MyHomeLab nem nas apps. Se uma regra estiver errada ou faltar, propõe a mudança com docs_propose (ele aprova na página Documentos, e a versão anterior fica guardada).
- O TREK: as ferramentas dele chegam diretamente (mcp__trek__<nome>), só as que leem.
- Não tens terminal, ficheiros nem web: só estas ferramentas. Se o pedido precisar de mais (mexer num servidor, numa app, num email), diz que é com o Jarvis no site.`;

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connectedAccountRepository: PrismaConnectedAccountRepository,
    private readonly emailRuleRepository: PrismaEmailRuleRepository,
    private readonly agentSettingRepository: PrismaAgentSettingRepository,
    private readonly agentRepository: PrismaAgentRepository,
    private readonly activity: AgentActivityService,
    private readonly promptProposals: AgentPromptProposalService,
    private readonly serverConnections: ServerConnectionService,
    private readonly serverCommands: ServerCommandService,
    private readonly serviceMonitors: ServiceMonitorService,
    private readonly diskHealth: DiskHealthService,
    private readonly diskAlerts: DiskAlertService,
    private readonly notifications: NotificationService,
    private readonly backups: BackupService,
    private readonly aiCredentials: AiCredentialService,
    private readonly sleep: HealthService,
    private readonly heartRate: HeartRateService,
    private readonly skinTemperature: SkinTemperatureService,
    private readonly bloodOxygen: BloodOxygenService,
    private readonly stress: StressService,
    private readonly steps: StepsService,
    private readonly exercise: ExerciseService,
    private readonly weight: WeightService,
    private readonly water: WaterService,
    private readonly labs: LabsService,
    private readonly records: HealthRecordsService,
    private readonly nutrition: NutritionService,
    private readonly body: BodyService,
    private readonly wellbeing: WellbeingService,
    private readonly medical: MedicalService,
    private readonly intakes: IntakesService,
    private readonly emailProposals: EmailRuleProposalService,
    private readonly docs: DocsService,
    private readonly updates: AppUpdateService,
    private readonly schedules: AgentScheduleService,
    private readonly projects: ProjectsService,
    private readonly board: BoardService,
    private readonly todos: TodoService,
    private readonly agentAccess: AgentAccessService,
    private readonly aiUsage: AiUsageService,
    private readonly chatFiles: ChatFileService,
    private readonly drive: DriveService,
    private readonly approvals: ChatApprovalService,
  ) {}

  private buildContext(
    user: JwtPayload,
    ai: AiClient,
    turnId: string,
    deniedPermissions: string[],
    team: Agent[],
    source = 'chat',
  ): AgentContext {
    // Lidas uma vez por volta, quando a primeira ferramenta de uma app as pede.
    let targets: Promise<AccessTarget[]> | null = null;
    return {
      docsUsed: new Map(),
      actionsDone: [],
      appAccess: () => (targets ??= this.agentAccess.targets(user.id)),
      recordUsage: (agentKey, usage) =>
        void this.aiUsage.record(user.id, agentKey, source, usage),
      userId: user.id,
      isAdmin: user.role === 'ADMIN',
      source,
      deniedPermissions,
      ai,
      connectedAccountRepository: this.connectedAccountRepository,
      emailRuleRepository: this.emailRuleRepository,
      agentRepository: this.agentRepository,
      team,
      activity: this.activity,
      promptProposals: this.promptProposals,
      emailProposals: this.emailProposals,
      serverConnections: this.serverConnections,
      serverCommands: this.serverCommands,
      serviceMonitors: this.serviceMonitors,
      diskHealth: this.diskHealth,
      diskAlerts: this.diskAlerts,
      notifications: this.notifications,
      backups: this.backups,
      docs: this.docs,
      projects: this.projects,
      updates: this.updates,
      schedules: this.schedules,
      board: this.board,
      todos: this.todos,
      chatFiles: this.chatFiles,
      drive: this.drive,
      approvals: this.approvals,
      health: {
        sleep: this.sleep,
        heart: this.heartRate,
        skin: this.skinTemperature,
        oxygen: this.bloodOxygen,
        stress: this.stress,
        steps: this.steps,
        exercise: this.exercise,
        weight: this.weight,
        water: this.water,
        labs: this.labs,
        records: this.records,
        nutrition: this.nutrition,
        body: this.body,
        wellbeing: this.wellbeing,
        medical: this.medical,
        intakes: this.intakes,
      },
      turnId,
    };
  }

  // ── Conversas ───────────────────────────────────────────────────────────

  /** As conversas, da mais recente para a mais antiga (a barra lateral). */
  async conversations(userId: string) {
    const rows = await this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
      select: {
        id: true,
        title: true,
        createdAt: true,
        lastMessageAt: true,
        boardTask: {
          select: {
            id: true,
            number: true,
            project: { select: { identifier: true } },
          },
        },
      },
    });
    return rows.map(({ boardTask, ...conversation }) => ({
      ...conversation,
      taskId: boardTask?.id ?? null,
      taskKey: boardTask
        ? `${boardTask.project.identifier}-${boardTask.number}`
        : null,
    }));
  }

  /** A conversa de uma tarefa ("Falar com o Jarvis"): a que já existe, ou uma nova. */
  async taskConversation(userId: string, taskId: string) {
    const task = await this.board.task(userId, taskId);
    const existing = await this.prisma.conversation.findUnique({
      where: { boardTaskId: taskId },
      select: { id: true, userId: true },
    });
    if (existing?.userId === userId) return { id: existing.id };
    const created = await this.prisma.conversation.create({
      data: {
        userId,
        boardTaskId: taskId,
        title: `${task.key} · ${task.title}`.slice(0, 120),
      },
    });
    return { id: created.id };
  }

  async conversationMessages(
    userId: string,
    conversationId: string,
    limit = 200,
  ): Promise<ChatEntry[]> {
    await this.findConversation(userId, conversationId);
    return this.messagesOf(conversationId, limit);
  }

  async renameConversation(userId: string, id: string, title: string) {
    await this.findConversation(userId, id);
    return this.prisma.conversation.update({
      where: { id },
      data: { title: title.trim().slice(0, 120) || DEFAULT_TITLE },
      select: { id: true, title: true, createdAt: true, lastMessageAt: true },
    });
  }

  async deleteConversation(userId: string, id: string): Promise<void> {
    await this.findConversation(userId, id);
    await this.prisma.conversation.delete({ where: { id } });
  }

  /** A resposta de um disparo com "para o chat": uma conversa nova com a data no título. */
  async postScheduledReply(schedule: AgentSchedule, reply: string) {
    const day = new Date().toLocaleDateString('pt-PT', {
      timeZone: 'Europe/Lisbon',
      day: '2-digit',
      month: '2-digit',
    });
    const conversation = await this.createConversation(
      schedule.userId,
      `${schedule.title} · ${day}`,
    );
    await this.prisma.chatMessage.create({
      data: {
        userId: schedule.userId,
        conversationId: conversation.id,
        role: ChatRole.ASSISTANT,
        // Na conversa seguinte o Jarvis lê isto como dele: a primeira linha diz que foi
        // um disparo a correr sozinho, não uma volta com ele.
        content: `_Disparo «${schedule.title}» — correu sozinho, sem ti._

${reply.trim()}`,
      },
    });
    return conversation;
  }

  /** Uma conversa nova, já com o título. */
  async createConversation(userId: string, title: string) {
    return this.prisma.conversation.create({
      data: { userId, title: title.trim().slice(0, 120) || DEFAULT_TITLE },
    });
  }

  private async findConversation(userId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
    });
    if (!conversation) throw new NotFoundException('Conversa não encontrada');
    return conversation;
  }

  /** A conversa onde vai a mensagem: a pedida, uma nova ou a mais recente. */
  private async resolveConversation(
    userId: string,
    message: string,
    target: ConversationTarget,
  ) {
    if (target.conversationId) {
      return this.findConversation(userId, target.conversationId);
    }
    const latest = target.newConversation
      ? null
      : await this.prisma.conversation.findFirst({
          where: { userId },
          orderBy: { lastMessageAt: 'desc' },
        });
    return latest ?? this.createConversation(userId, titleFrom(message));
  }

  private async messagesOf(
    conversationId: string,
    limit: number,
  ): Promise<ChatEntry[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        files: {
          select: {
            id: true,
            name: true,
            mimeType: true,
            size: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return rows.reverse().map((row) => ({
      id: row.id,
      role: row.role === ChatRole.USER ? 'user' : 'assistant',
      content: row.content,
      createdAt: row.createdAt,
      docsUsed:
        (row.docsUsed as { id: string; title: string }[] | null) ?? undefined,
      actions: (row.actions as string[] | null) ?? undefined,
      ...(row.files.length ? { files: row.files } : {}),
    }));
  }

  /** Um ficheiro que ele mandou no chat (para o abrir na página). */
  chatFile(userId: string, id: string) {
    return this.chatFiles.get(userId, id);
  }

  /** As últimas mensagens da conversa mais recente (o que a app Android mostra). */
  async history(userId: string, limit: number): Promise<ChatEntry[]> {
    const latest = await this.prisma.conversation.findFirst({
      where: { userId },
      orderBy: { lastMessageAt: 'desc' },
    });
    if (!latest) return [];
    return this.messagesOf(latest.id, limit);
  }

  /** "Limpar" da app Android: apaga todas as conversas. */
  async clear(userId: string): Promise<void> {
    await this.prisma.conversation.deleteMany({ where: { userId } });
    await this.prisma.chatMessage.deleteMany({ where: { userId } });
  }

  async ask(
    user: JwtPayload,
    message: string,
    target: ConversationTarget = {},
    uploads: UploadedChatFile[] = [],
  ): Promise<{
    reply: string;
    conversationId: string;
    docsUsed?: { id: string; title: string }[];
  }> {
    // A hora da pergunta: gravadas juntas no fim, a pergunta e a resposta ficariam com
    // a mesma hora, e a ordem entre as duas deixava de ser certa.
    const askedAt = new Date();
    // Sem chave não há assistente — não existe chave geral no servidor. O código
    // deixa o frontend mostrar o caminho para Assistente → Definições → IA.
    const ai = await this.aiCredentials.requireClient(user.id);
    this.chatFiles.validate(uploads);
    if (!message.trim() && !uploads.length) {
      throw new BadRequestException(
        'Escreve uma mensagem ou junta um ficheiro.',
      );
    }

    const thread = await this.resolveConversation(
      user.id,
      message.trim() || uploads.map(uploadName).join(', '),
      target,
    );
    const previous = await this.messagesOf(thread.id, CONTEXT_MESSAGES);
    // A pergunta grava-se já: um pedido longo (o Jarvis a delegar) pode passar o tempo
    // de um proxy à frente do MyHomeLab, e a página volta a buscá-la ao histórico. Se a
    // equipa falhar, fica uma resposta a dizer porquê — nunca uma pergunta sem resposta.
    const [question] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: {
          userId: user.id,
          conversationId: thread.id,
          role: ChatRole.USER,
          content: message,
          createdAt: askedAt,
        },
      }),
      this.prisma.conversation.update({
        where: { id: thread.id },
        data: { lastMessageAt: askedAt },
      }),
    ]);
    const answer = (
      content: string,
      extra: {
        docsUsed?: ReturnType<typeof docsList>;
        actions?: string[];
      } = {},
    ) =>
      this.prisma.$transaction([
        this.prisma.chatMessage.create({
          data: {
            userId: user.id,
            conversationId: thread.id,
            role: ChatRole.ASSISTANT,
            content,
            createdAt: new Date(Math.max(Date.now(), askedAt.getTime() + 1)),
            ...(extra.docsUsed ? { docsUsed: extra.docsUsed } : {}),
            ...(extra.actions?.length ? { actions: extra.actions } : {}),
          },
        }),
        this.prisma.conversation.update({
          where: { id: thread.id },
          data: { lastMessageAt: new Date() },
        }),
      ]);
    // A conversa de uma tarefa: falar aqui responde à tarefa, e o Jarvis recebe-a.
    const taskNotice = thread.boardTaskId
      ? await this.board.chatContext(user.id, thread.boardTaskId)
      : '';
    if (thread.boardTaskId) {
      await this.board
        .answeredInChat(user.id, thread.boardTaskId)
        .catch(() => undefined);
    }

    // Os ficheiros desta mensagem vão inteiros (ou lidos) no pedido; os das mensagens
    // anteriores vão só pelo nome e id, e os agentes voltam a eles pelas chat_file_*.
    const files = uploads.length
      ? await this.chatFiles.save(user.id, thread.id, question.id, uploads)
      : [];
    const conversation: MessageParam[] = previous.map((entry) => ({
      role: entry.role,
      content:
        entry.role === 'assistant' && entry.actions?.length
          ? `${entry.content}\n\n${ACTIONS_NOTE} ${entry.actions.join('; ')}]`
          : entry.files?.length
            ? `${entry.content}\n\n[Ficheiros desta mensagem (lê-os com chat_file_read, chat_file_query ou chat_file_ask): ${entry.files.map(fileLine).join('; ')}]`
            : entry.content,
    }));
    conversation.push({
      role: 'user',
      content: files.length
        ? this.chatFiles.turnContent(files, message)
        : message,
    });

    // Uma volta de conversa = uma mensagem dele e a resposta que se lhe segue.
    // As alterações de prompt que o agente proponha ficam presas a este id e não
    // podem ser aplicadas antes de haver uma volta nova — ou seja, antes de uma
    // pessoa ter escrito outra coisa qualquer.
    const turnId = randomUUID();
    const team = await this.team(user.id);
    const ceo = team.find((agent) => !agent.reportsToId)!;
    const context = this.buildContext(
      user,
      ai,
      turnId,
      await this.agentSettingRepository.findDeniedPermissions(user.id),
      team,
    );
    context.conversationId = thread.id;
    context.filesInTurn = files.length > 0;
    context.userMessage = message;

    // Estado que muda de volta para volta entra aqui, no fim das mensagens — e
    // nunca no system prompt, que tem de ficar byte a byte igual para a cache
    // valer. Uma mensagem de sistema a meio da conversa carrega a mesma
    // autoridade sem tocar no prefixo.
    const notice = [
      taskNotice,
      describePendingProposals(context).trim(),
      await this.describePendingApprovals(user.id, thread.id),
      await this.describeWaitingUpdates(user.id),
    ]
      .filter(Boolean)
      .join('\n\n');
    if (notice) {
      conversation.push({
        role: 'system',
        content: notice,
      } as unknown as MessageParam);
    }

    let replyText: string;
    try {
      ({ replyText } = await this.activity.track(
        user.id,
        ceo.key,
        'a responder',
        // O CEO corre como qualquer agente da equipa: as instruções, o modelo e
        // as ferramentas vêm da configuração dele, e a equipa entra como ferramentas.
        () => runTeamAgent(ceo, conversation, context),
        { from: 'user', text: message },
      ));
    } catch (error) {
      // Chave revogada depois de gravada, conta sem crédito, limite de pedidos:
      // são da conta de quem fala, e chegam ao browser com um código traduzível.
      const failure: unknown = aiFailure(error) ?? error;
      const reason =
        failure instanceof HttpException
          ? ((failure.getResponse() as { message?: string }).message ??
            failure.message)
          : failure instanceof Error
            ? failure.message
            : String(failure);
      await answer(
        `⚠️ Não consegui responder: ${reason}\n\nVolta a perguntar quando quiseres.`,
      ).catch(() => undefined);
      throw failure;
    }

    // A nota do que a equipa fez é só para o histórico: se o modelo a imitar, sai da resposta.
    const reply =
      stripActionsNote(replyText) || 'Não consegui gerar uma resposta.';

    await answer(reply, {
      docsUsed: docsList(context.docsUsed),
      actions: context.actionsDone?.slice(0, 60),
    });

    return {
      reply,
      conversationId: thread.id,
      docsUsed: docsList(context.docsUsed),
    };
  }

  /**
   * Pré-visualização do estilo: a última pergunta da conversa, respondida de novo
   * com o rascunho das instruções do Jarvis — sem as gravar e sem ferramentas. A
   * informação é a da resposta original; só a forma muda, que é o que se quer ver.
   */
  async previewStyle(
    user: JwtPayload,
    customPrompt: string | undefined,
  ): Promise<{ question: string; before: string; after: string }> {
    const ai = await this.aiCredentials.requireClient(user.id);

    const recent = await this.history(user.id, CONTEXT_MESSAGES);
    const answerIndex = recent
      .map((entry) => entry.role)
      .lastIndexOf('assistant');
    const question = answerIndex > 0 ? recent[answerIndex - 1] : null;
    if (!question || question.role !== 'user') {
      throw new BadRequestException(
        'Ainda não há nenhuma resposta na conversa para comparar. Fala com o Jarvis e volta aqui.',
      );
    }
    const before = recent[answerIndex].content;

    const ceo = (await this.team(user.id)).find((agent) => !agent.reportsToId)!;
    const systemPrompt = appendCustomPrompt(
      ceo.prompt ?? templatePrompt(ceo.template) ?? '',
      customPrompt,
    );
    const request =
      'Pré-visualização de estilo — não uses ferramentas nem acrescentes informação. ' +
      `O utilizador perguntou: "${question.content}"\n\n` +
      `A resposta, com os dados certos, foi:\n${before}\n\n` +
      'Escreve a resposta que darias agora, seguindo as tuas instruções, com exatamente a ' +
      'mesma informação. Responde só com essa resposta.';

    try {
      const { replyText } = await runAgent(
        ai,
        systemPrompt,
        [],
        [{ role: 'user', content: request }],
      );
      return { question: question.content, before, after: replyText };
    } catch (error) {
      throw aiFailure(error) ?? error;
    }
  }

  /** As atualizações à espera de uma resposta do utilizador ou de verificação (o Jarvis lembra-as). */
  private async describeWaitingUpdates(userId: string): Promise<string> {
    const updates = await this.updates.list(userId);
    const verifying = updates.filter((update) => update.status === 'VERIFYING');
    const waiting = updates.filter(
      (update) => update.status === 'WAITING' && update.question,
    );
    const toVerify = verifying.length
      ? 'Atualizações instaladas por verificar (o "feito quando" da especificação):\n' +
        verifying
          .map(
            (update) =>
              `  · ${update.id} — ${targetLabel(update)} ${update.fromVersion} → ${update.toVersion}`,
          )
          .join('\n') +
        '\nSe ainda não estiverem verificadas, pede ao agente que trata das atualizações (o que tem update_verify) para as verificar com update_verify.\n'
      : '';
    if (!waiting.length) return toVerify;
    return (
      toVerify +
      'Atualizações à espera de uma resposta do utilizador:\n' +
      waiting
        .map(
          (update) =>
            `  · ${update.id} — ${targetLabel(update)} ${update.fromVersion} → ${update.toVersion}` +
            (update.boardTaskKey ? ` (${update.boardTaskKey})` : '') +
            `: ${update.question}`,
        )
        .join('\n') +
      '\nSe ele responder a uma destas, passa a resposta ao agente que trata das atualizações (que a regista com update_set_status ou volta a preparar a atualização).'
    );
  }

  /** Os cartões do chat por decidir nesta conversa (enviar, mudar a equipa, instalar). */
  private async describePendingApprovals(
    userId: string,
    conversationId: string,
  ): Promise<string> {
    const pending = await this.approvals.describePending(
      userId,
      conversationId,
    );
    return pending
      ? `Cartões por decidir nesta conversa (só ele decide: no cartão, ou dizendo-te numa mensagem nova — aí usas approval_decide):
${pending}`
      : '';
  }

  /**
   * Verificar uma atualização instalada (o agendador): o agente que tem
   * update_verify confere o "feito quando" da especificação, com prova. Corre
   * em segundo plano e só uma vez por atualização.
   */
  async verifyUpdate(userId: string, updateId: string): Promise<void> {
    const update = await this.updates.get(userId, updateId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, username: true, role: true },
    });
    const ai = await this.aiCredentials.requireClient(userId, 'install');
    const team = await this.team(userId);
    const agent = team.find(
      (member) => member.isActive && member.tools.includes('update_verify'),
    );
    await this.updates.markVerify(update.id);
    if (!agent) {
      await this.updates.verifyStalled(
        update.id,
        'nenhum agente ativo tem a ferramenta update_verify (Assistente → Workflow)',
      );
      return;
    }
    const context = this.buildContext(
      { id: user.id, username: user.username, role: user.role },
      ai,
      randomUUID(),
      await this.agentSettingRepository.findDeniedPermissions(userId),
      team,
      'verify',
    );
    const request = this.updates.verifyRequest(update);
    void this.activity
      .track(
        userId,
        agent.key,
        `a verificar a atualização ${update.toVersion}`,
        () =>
          runTeamAgent(agent, [{ role: 'user', content: request }], context),
        { from: 'user', text: request },
      )
      // Acabou sem fechar a verificação (ou com erro): não fica em Verifying a parar a fila.
      .then(() =>
        this.updates.verifyStalled(
          update.id,
          'o agente acabou sem gravar a verificação (update_verify)',
        ),
      )
      .catch((error: unknown) =>
        this.updates
          .verifyStalled(
            update.id,
            error instanceof Error ? error.message : String(error),
          )
          .catch(() => undefined),
      );
  }

  /**
   * Instalar uma atualização que está em Ready to update (o agendador, na janela):
   * o agente que tem update_run prepara, valida os pontos das regras, corre e
   * verifica. Espera pelo fim; se ficou por instalar, passa a Waiting for reply.
   */
  async installUpdate(userId: string, updateId: string): Promise<void> {
    const update = await this.updates.get(userId, updateId);
    await this.updates.markInstall(update.id);
    // Tudo o que pode falhar fica dentro do try: um erro aqui passa a Waiting for reply
    // (com o porquê nas notificações), em vez de ficar 20 h à espera calada.
    try {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, username: true, role: true },
      });
      const ai = await this.aiCredentials.requireClient(userId, 'install');
      const team = await this.team(userId);
      const agent = team.find(
        (member) => member.isActive && member.tools.includes('update_run'),
      );
      if (!agent) {
        await this.updates.afterInstall(
          update.id,
          '',
          'nenhum agente ativo tem a ferramenta update_run (Assistente → Workflow)',
        );
        return;
      }
      const context = this.buildContext(
        { id: user.id, username: user.username, role: user.role },
        ai,
        randomUUID(),
        await this.agentSettingRepository.findDeniedPermissions(userId),
        team,
        'install',
      );
      const request = await this.updates.installRequest(update);
      // Enquanto o agente acompanha, uma corrida que falha fica à espera dele.
      watchedInstalls.add(update.id);
      const result = await this.activity.track(
        userId,
        agent.key,
        `a instalar a atualização ${update.toVersion}`,
        () =>
          runTeamAgent(agent, [{ role: 'user', content: request }], context),
        { from: 'user', text: request },
      );
      watchedInstalls.delete(update.id);
      await this.updates.afterInstall(update.id, result.replyText);
    } catch (error) {
      watchedInstalls.delete(update.id);
      await this.updates.afterInstall(
        update.id,
        '',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Um agendamento a correr (o utilizador não está a acompanhar). O "rever mais tarde"
   * de uma atualização volta a estudá-la; os outros mandam a instrução ao agente.
   * Espera pelo fim e devolve a resposta e os tokens gastos.
   */
  /** `extra`: o que o disparo traz (ex.: as atualizações novas, nos "quando aparece"). */
  async runScheduled(
    schedule: AgentSchedule,
    extra?: string,
  ): Promise<{
    reply: string;
    tokensIn: number;
    tokensOut: number;
    docsUsed?: { id: string; title: string }[];
  }> {
    const userId = schedule.userId;
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, username: true, role: true },
    });
    const ai = await this.aiCredentials.requireClient(
      userId,
      schedule.updateId && schedule.title.startsWith('Estudar')
        ? 'study'
        : 'schedule',
    );
    const team = await this.team(userId);
    const usage = { input: 0, output: 0 };
    const context: AgentContext = {
      ...this.buildContext(
        { id: user.id, username: user.username, role: user.role },
        ai,
        randomUUID(),
        await this.agentSettingRepository.findDeniedPermissions(userId),
        team,
        schedule.updateId ? 'study' : 'schedule',
      ),
      onUsage: (used) => {
        usage.input += used.input;
        usage.output += used.output;
      },
    };

    let agent: Agent | undefined;
    let request: string;
    let studyId: string | null = null;
    if (schedule.updateId) {
      // O "rever mais tarde" volta a pô-la em estudo; o "Estudar …" já a encontra lá.
      const waiting =
        (await this.updates.recheckNow(schedule.updateId)) ??
        (await this.updates.studyQueued(schedule.updateId));
      if (!waiting) {
        return {
          reply:
            'A atualização já não estava à espera de estudo nem em "Recheck later": não havia nada a estudar.',
          tokensIn: 0,
          tokensOut: 0,
        };
      }
      const update = await this.updates.requestStudy(userId, waiting.id);
      agent = team.find(
        (member) =>
          member.isActive && member.tools.includes('update_save_study'),
      );
      if (!agent) {
        throw new Error(
          'Nenhum agente tem a ferramenta update_save_study: a atualização voltou ao estudo, mas ninguém a estuda.',
        );
      }
      request = await this.updates.studyBrief(update);
      studyId = update.id;
      await this.updates.markStudy(update.id, true);
    } else {
      agent = team.find((member) => member.key === schedule.agentKey);
      if (!agent?.isActive) {
        throw new Error(
          `O agente "${schedule.agentKey}" ${agent ? 'está desligado' : 'já não existe'} (Assistente → Workflow).`,
        );
      }
      request = extra
        ? `${scheduledRequest(schedule)}

${extra}`
        : scheduledRequest(schedule);
    }

    try {
      const result = await this.activity.track(
        userId,
        agent.key,
        `agendamento: ${schedule.title}`,
        () =>
          runTeamAgent(agent, [{ role: 'user', content: request }], context),
        { from: 'user', text: request },
      );
      if (studyId) await this.updates.afterStudy(studyId);
      return {
        reply: result.replyText.trim(),
        tokensIn: usage.input,
        tokensOut: usage.output,
        docsUsed: docsList(context.docsUsed),
      };
    } catch (error) {
      if (studyId) {
        await this.updates.afterStudy(
          studyId,
          error instanceof Error ? error.message : String(error),
        );
      }
      throw error;
    }
  }

  /**
   * Uma sessão do terminal (`npm run claude`): o utilizador do terminal
   * (MYHOMELAB_TERMINAL_USER, ou o primeiro administrador), a ponte MCP com as
   * ferramentas do terminal (os documentos e o TREK só a ler) por 12 horas, o MCP
   * do TREK diretamente (só as que leem) e as instruções com o índice dos
   * documentos e os obrigatórios gerais.
   */
  async terminalSession() {
    const wanted = process.env.MYHOMELAB_TERMINAL_USER?.trim();
    const user = await this.prisma.user.findFirstOrThrow({
      where: wanted ? { username: wanted } : { role: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, username: true, role: true },
    });
    const ai = await this.aiCredentials.requireClient(user.id);
    const team = await this.team(user.id);
    const denied = await this.agentSettingRepository.findDeniedPermissions(
      user.id,
    );
    const context = {
      ...this.buildContext(user, ai, randomUUID(), denied, team, 'terminal'),
      agentKey: TERMINAL_AGENT,
    };
    const tools = guardTools(
      await buildToolbox(TERMINAL_TOOLS, context),
      denied,
      { agentKey: TERMINAL_AGENT, targets: context.appAccess },
    );
    const bridge = openBridge(tools, TERMINAL_SESSION_MS);
    const trek = await trekDirect(TERMINAL_TOOLS, context, TERMINAL_AGENT);
    const docs = await this.docs.agentContext(user.id);
    return {
      user: user.username,
      model: ai.models.main,
      mcpServers: { [BRIDGE_SERVER]: bridge.server, ...trek?.servers },
      allowedTools: [`${BRIDGE_PREFIX}*`, ...(trek?.allowedTools ?? [])],
      systemPrompt: `${TERMINAL_PROMPT}

${docsSection(docs)}`,
    };
  }

  private team(userId: string): Promise<Agent[]> {
    return ensureTeam(
      this.agentRepository,
      this.agentSettingRepository,
      userId,
    );
  }
}
