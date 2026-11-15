import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Observable, Subject, filter, map } from 'rxjs';
import { AgentLog } from 'src/generated/prisma/client/client';
import { PrismaAgentLogRepository } from './repositories/prisma/prisma-agent-log-repository';
import { NewAgentLog } from './repositories/agent-log-repository';
import { resultSummary } from './helpers/resultSummary';
import { PrismaAgentRepository } from 'src/agent/repositories/prisma/prisma-agent-repository';

/** A chave do agente na equipa do utilizador ('ceo', 'admin', ou de um criado por ele). */
export type AgentKey = string;

export type AgentStatus = 'IDLE' | 'ACTIVE';

export interface AgentActivity {
  agent: AgentKey;
  status: AgentStatus;
  /** O que está a fazer neste momento, em linguagem corrente. Null quando parado. */
  action: string | null;
  /** Quando começou o trabalho em curso. Null quando parado. */
  since: string | null;
  /** Fim do último trabalho, para a página poder dizer "há 3 minutos". */
  lastActiveAt: string | null;
}

/** Quem pediu um trabalho: o utilizador (site ou app) ou outro agente. */
export interface AgentRequest {
  /** A chave de outro agente, ou 'user'. */
  from: AgentKey;
  text: string;
}

/** O registo guarda 30 dias. */
const LOG_KEEP_DAYS = 30;
const MAX_REQUEST_LENGTH = 500;

interface UserAgents {
  state: Map<AgentKey, AgentActivity>;
  // Um agente pode ser chamado duas vezes ao mesmo tempo (uma pergunta no site e um
  // scheduler a correr). Contam-se os trabalhos em curso para o primeiro a acabar não
  // apagar o verde do que ainda está a correr.
  running: Map<AgentKey, number>;
}

/**
 * Guarda, em memória, o que os agentes de cada utilizador estão a fazer, e emite as
 * mudanças para quem estiver a ouvir (a constelação do Jarvis, por SSE). Cada
 * utilizador tem os seus agentes — ninguém vê o assistente de outro a trabalhar.
 *
 * Em memória de propósito: isto é estado do processo, não do domínio. Não sobrevive a
 * um reinício nem precisa — um agente não fica a trabalhar de um arranque para o outro.
 * Só é correto porque corre um único backend; com mais que uma instância cada uma veria
 * apenas os seus próprios agentes.
 *
 * Além do estado, cada passo fica no registo (AgentLog, página Workflow): o pedido,
 * o início, cada ação, e o fim com a duração ou o erro. Esse sim vai para a base de
 * dados, para se ver o que correu de madrugada.
 */
@Injectable()
export class AgentActivityService {
  private readonly users = new Map<string, UserAgents>();

  private readonly logger = new Logger(AgentActivityService.name);

  private readonly changes = new Subject<{
    userId: string;
    snapshot: AgentActivity[];
  }>();

  private readonly logChanges = new Subject<AgentLog>();

  // As escritas no registo vão em fila: assim chegam à página pela ordem em que
  // aconteceram, sem o agente ter de esperar pela base de dados.
  private logQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly logs: PrismaAgentLogRepository,
    private readonly agents: PrismaAgentRepository,
  ) {}

  /** Só os agentes que já trabalharam desde o arranque; os outros estão parados. */
  snapshot(userId: string): AgentActivity[] {
    const { state } = this.forUser(userId);
    return [...state.values()].map((entry) => ({ ...entry }));
  }

  stream(userId: string): Observable<AgentActivity[]> {
    return this.changes.asObservable().pipe(
      filter((change) => change.userId === userId),
      map((change) => change.snapshot),
    );
  }

  /** As linhas novas do registo, ao vivo. */
  logStream(userId: string): Observable<AgentLog> {
    return this.logChanges
      .asObservable()
      .pipe(filter((entry) => entry.userId === userId));
  }

  logPage(
    userId: string,
    options: { agent?: string; before?: Date; limit: number },
  ) {
    return this.logs.findPage(userId, options);
  }

  start(userId: string, agent: AgentKey, action: string): void {
    const { running } = this.forUser(userId);
    running.set(agent, (running.get(agent) ?? 0) + 1);
    this.write(userId, agent, {
      status: 'ACTIVE',
      action,
      since: this.current(userId, agent).since ?? new Date().toISOString(),
    });
  }

  /** Muda a linha do que está a fazer sem mexer no estado de ativo. */
  update(userId: string, agent: AgentKey, action: string): void {
    const { running } = this.forUser(userId);
    if ((running.get(agent) ?? 0) === 0) return;
    if (this.current(userId, agent).action === action) return;
    this.write(userId, agent, { action });
    this.log({ userId, agent, kind: 'ACTION', text: action });
  }

  finish(userId: string, agent: AgentKey): void {
    const { running } = this.forUser(userId);
    const left = Math.max(0, (running.get(agent) ?? 1) - 1);
    running.set(agent, left);
    if (left > 0) return;

    this.write(userId, agent, {
      status: 'IDLE',
      action: null,
      since: null,
      lastActiveAt: new Date().toISOString(),
    });
  }

  /**
   * Envolve um trabalho: marca ativo, corre, e garante o regresso a parado mesmo que
   * rebente. Sem o finally, um erro deixava o agente verde para sempre.
   */
  async track<T>(
    userId: string,
    agent: AgentKey,
    action: string,
    work: () => Promise<T>,
    request?: AgentRequest,
  ): Promise<T> {
    if (request?.text.trim()) {
      this.log({
        userId,
        agent,
        kind: 'REQUEST',
        text: request.text.trim().slice(0, MAX_REQUEST_LENGTH),
        requestedBy: request.from,
      });
    }
    this.start(userId, agent, action);
    this.log({
      userId,
      agent,
      kind: 'START',
      text: action,
      requestedBy: request?.from ?? null,
    });
    const started = Date.now();
    try {
      const result = await work();
      this.log({
        userId,
        agent,
        kind: 'DONE',
        text: resultSummary(result) ?? '',
        durationMs: Date.now() - started,
      });
      return result;
    } catch (error) {
      this.log({
        userId,
        agent,
        kind: 'FAILED',
        text: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - started,
      });
      throw error;
    } finally {
      this.finish(userId, agent);
    }
  }

  /**
   * O trabalho automático (o cron das regras, o "Executar agora") não vem de um agente:
   * fica com o agente da equipa que tem a ferramenta dessa área, ou com o CEO se
   * ninguém a tiver.
   */
  async trackOwner<T>(
    userId: string,
    tool: string,
    action: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const owner = await this.agents
      .findOwnerOfTool(userId, tool)
      .catch(() => null);
    return this.track(userId, owner ?? 'ceo', action, work);
  }

  /** Limpa o registo com mais de 30 dias, todas as noites. */
  @Cron('0 30 4 * * *', { name: 'Limpar a atividade dos agentes' })
  async pruneLogs(): Promise<void> {
    const limit = new Date(Date.now() - LOG_KEEP_DAYS * 24 * 60 * 60_000);
    await this.logs.deleteOlderThan(limit);
  }

  private log(entry: NewAgentLog): void {
    this.logQueue = this.logQueue
      .then(async () => this.logChanges.next(await this.logs.create(entry)))
      .catch((error: unknown) =>
        this.logger.warn(
          `Não consegui guardar o registo do agente ${entry.agent}: ${String(error)}`,
        ),
      );
  }

  private forUser(userId: string): UserAgents {
    let entry = this.users.get(userId);
    if (!entry) {
      entry = { state: new Map(), running: new Map() };
      this.users.set(userId, entry);
    }
    return entry;
  }

  private write(
    userId: string,
    agent: AgentKey,
    patch: Partial<AgentActivity>,
  ): void {
    const { state } = this.forUser(userId);
    state.set(agent, { ...this.current(userId, agent), ...patch });
    this.changes.next({ userId, snapshot: this.snapshot(userId) });
  }

  private current(userId: string, agent: AgentKey): AgentActivity {
    return (
      this.forUser(userId).state.get(agent) ?? {
        agent,
        status: 'IDLE',
        action: null,
        since: null,
        lastActiveAt: null,
      }
    );
  }
}
