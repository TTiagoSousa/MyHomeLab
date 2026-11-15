import { Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { recentProblems } from './helpers/statusLogger';

const DAY_MS = 86_400_000;
const startedAt = new Date();

/** O ecrã de estado do próprio MyHomeLab: a base de dados, as tarefas automáticas e os últimos erros. */
@Injectable()
export class StatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  async status() {
    const dbStart = Date.now();
    const database = await this.prisma.$queryRaw`SELECT 1`
      .then(() => ({
        ok: true,
        ms: Date.now() - dbStart,
        error: null as string | null,
      }))
      .catch((error: unknown) => ({
        ok: false,
        ms: Date.now() - dbStart,
        error: error instanceof Error ? error.message : String(error),
      }));
    const since = new Date(Date.now() - DAY_MS);
    const [
      failedRuns,
      runningRuns,
      boardErrors,
      studyErrors,
      openNotifications,
    ] = await Promise.all([
      this.prisma.agentScheduleRun.count({
        where: { status: 'FAILED', startedAt: { gte: since } },
      }),
      this.prisma.agentScheduleRun.count({ where: { status: 'RUNNING' } }),
      this.prisma.appUpdate.count({ where: { boardError: { not: null } } }),
      this.prisma.appUpdate.count({
        where: { studyError: { not: null }, status: 'STUDY' },
      }),
      this.prisma.notification.count({ where: { resolvedAt: null } }),
    ]);
    const jobs = [...this.scheduler.getCronJobs().entries()]
      .filter(([name]) => !/^[0-9a-f-]{36}$/.test(name))
      .map(([name, job]) => ({
        name,
        lastRun: job.lastDate()?.toISOString() ?? null,
        nextRun: job.nextDate()?.toJSDate().toISOString() ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      startedAt: startedAt.toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      node: process.version,
      memoryMb: Math.round(process.memoryUsage().rss / 1_048_576),
      database,
      jobs,
      counts: {
        failedRuns,
        runningRuns,
        boardErrors,
        studyErrors,
        openNotifications,
      },
      problems: recentProblems().slice(0, 40),
    };
  }
}
