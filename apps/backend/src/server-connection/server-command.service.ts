import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  DocLinkType,
  ServerCommand,
  ServerCommandStatus,
  ServerConnection,
} from 'src/generated/prisma/client/client';
import { decryptToken, encryptToken } from 'src/utils/crypto/token-cipher';
import { normalizeHost } from 'src/proxmox/proxmox.client';
import { classifyCommand } from './helpers/commandSafety';
import { generateSshKeys, sshExec } from './helpers/sshExec';
import { INVENTORY_SCRIPT } from './helpers/inventoryScript';
import { snapshotBeforeCommand } from './helpers/snapshotBeforeCommand';
import { verifySshHostKey } from './helpers/verifySshHostKey';
import { PrismaServerHostKeyRepository } from './repositories/prisma/prisma-server-host-key-repository';
import { DocsService } from 'src/docs/docs.service';

export interface CommandRequest {
  command: string;
  reason?: string;
  requestedBy?: string;
  turnId?: string;
}

/**
 * Quem corre uma atualização de app aprovada (o AppUpdateService regista-se
 * aqui, para este serviço não depender dele). Começa em segundo plano e
 * devolve logo o pedido já em curso.
 */
export type UpdateRunner = (row: ServerCommand) => Promise<void>;

const newCode = () =>
  randomBytes(4)
    .toString('base64')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, 6)
    .toUpperCase() || 'CMD';

/**
 * Os comandos por SSH (nível 2). Correm todos logo e ficam registados (os que
 * alteram também no registo do dia do servidor). O código não trava nada: o que
 * um agente pode fazer, e quando, está nas regras (documentos).
 */
@Injectable()
export class ServerCommandService {
  private updateRunner: UpdateRunner | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly docs: DocsService,
    private readonly hostKeys: PrismaServerHostKeyRepository,
  ) {}

  registerUpdateRunner(runner: UpdateRunner) {
    this.updateRunner = runner;
  }

  // ── Chave SSH ───────────────────────────────────────────────────────────

  /** Gera (ou troca) o par de chaves; a pública tem de ir para o authorized_keys do servidor. */
  async enableSsh(
    userId: string,
    serverId: string,
    input: { user?: string; port?: number },
  ) {
    const server = await this.findServer(userId, serverId);
    const keys = generateSshKeys(`myhomelab-${server.name}`);
    return this.prisma.serverConnection.update({
      where: { id: server.id },
      data: {
        sshUser: input.user?.trim() || server.sshUser || 'root',
        sshPort: input.port ?? server.sshPort,
        sshPrivateKey: encryptToken(keys.privateKey),
        sshPublicKey: keys.publicKey,
      },
    });
  }

  async updateSsh(
    userId: string,
    serverId: string,
    input: { user?: string; port?: number },
  ) {
    const server = await this.findServer(userId, serverId);
    return this.prisma.serverConnection.update({
      where: { id: server.id },
      data: {
        sshUser: input.user?.trim() || server.sshUser,
        sshPort: input.port ?? server.sshPort,
      },
    });
  }

  async disableSsh(userId: string, serverId: string) {
    const server = await this.findServer(userId, serverId);
    await this.prisma.serverConnection.update({
      where: { id: server.id },
      data: { sshPrivateKey: null, sshPublicKey: null },
    });
  }

  /**
   * Esquece a chave guardada do servidor: a próxima ligação guarda a que ele
   * apresentar (para depois de reinstalar o servidor).
   */
  async resetSshHostKey(userId: string, serverId: string) {
    const server = await this.findServer(userId, serverId);
    await this.hostKeys.clear(server.id);
  }

  /** Entra e corre `hostname` — não fica no registo. */
  async testSsh(userId: string, serverId: string) {
    const server = await this.findServer(userId, serverId);
    try {
      const result = await sshExec(this.target(server), 'hostname && uptime', {
        timeoutMs: 20_000,
      });
      return { ok: result.exitCode === 0, output: result.output.trim() };
    } catch (error) {
      return {
        ok: false,
        output: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ── Comandos ────────────────────────────────────────────────────────────

  /** Um agente corre um comando: corre já e fica registado. */
  async request(
    userId: string,
    server: ServerConnection,
    input: CommandRequest,
  ): Promise<ServerCommand> {
    this.target(server);
    const kind = classifyCommand(input.command);
    const row = await this.prisma.serverCommand.create({
      data: {
        code: newCode(),
        userId,
        serverConnectionId: server.id,
        command: input.command.trim(),
        reason: input.reason?.trim() || null,
        requestedBy: input.requestedBy ?? null,
        turnId: input.turnId ?? null,
        status: ServerCommandStatus.PENDING,
        autoApproved: kind === 'read',
      },
    });
    return this.execute(row, server);
  }

  /** O registo de uma atualização de app: o snapshot, os comandos, a verificação e, se falhar, a volta ao snapshot. */
  requestUpdate(
    userId: string,
    server: ServerConnection,
    input: CommandRequest & { updateId: string },
  ): Promise<ServerCommand> {
    this.target(server);
    return this.prisma.serverCommand.create({
      data: {
        code: newCode(),
        userId,
        serverConnectionId: server.id,
        command: input.command.trim(),
        reason: input.reason?.trim() || null,
        requestedBy: input.requestedBy ?? null,
        turnId: input.turnId ?? null,
        status: ServerCommandStatus.PENDING,
        updateId: input.updateId,
      },
    });
  }

  /** Um passo de uma atualização: corre e fica no registo do servidor. */
  async runUpdateStep(
    userId: string,
    server: ServerConnection,
    input: {
      command: string;
      reason: string;
      requestedBy?: string;
      timeoutMs: number;
    },
  ): Promise<ServerCommand> {
    const target = this.target(server);
    const row = await this.prisma.serverCommand.create({
      data: {
        code: newCode(),
        userId,
        serverConnectionId: server.id,
        command: input.command.trim(),
        reason: input.reason,
        requestedBy: input.requestedBy ?? null,
        status: ServerCommandStatus.RUNNING,
        decidedAt: new Date(),
      },
    });
    let status: ServerCommandStatus = ServerCommandStatus.DONE;
    let output = '';
    let exitCode: number | null = null;
    try {
      const result = await sshExec(target, input.command, {
        timeoutMs: input.timeoutMs,
      });
      output = result.output;
      exitCode = result.exitCode;
      if (exitCode !== 0) status = ServerCommandStatus.FAILED;
    } catch (error) {
      status = ServerCommandStatus.FAILED;
      output = error instanceof Error ? error.message : String(error);
    }
    return this.prisma.serverCommand.update({
      where: { id: row.id },
      data: { status, output, exitCode, finishedAt: new Date() },
    });
  }

  /** Marca o pedido de uma atualização como acabado (o AppUpdateService chama no fim). */
  finishUpdate(id: string, ok: boolean, output: string) {
    return this.prisma.serverCommand.update({
      where: { id },
      data: {
        status: ok ? ServerCommandStatus.DONE : ServerCommandStatus.FAILED,
        output,
        exitCode: ok ? 0 : 1,
        finishedAt: new Date(),
      },
    });
  }

  async list(userId: string, serverId: string, limit = 30) {
    await this.findServer(userId, serverId);
    return this.prisma.serverCommand.findMany({
      where: { userId, serverConnectionId: serverId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  /**
   * O inventário do servidor (o script fixo do MyHomeLab, só leitura): corre já e
   * fica no registo como um comando de leitura.
   */
  async inventory(
    userId: string,
    server: ServerConnection,
    requestedBy?: string,
  ): Promise<ServerCommand> {
    const target = this.target(server);
    const row = await this.prisma.serverCommand.create({
      data: {
        code: newCode(),
        userId,
        serverConnectionId: server.id,
        command: 'inventário do servidor (script de leitura do MyHomeLab)',
        reason: 'Estudar o servidor',
        requestedBy: requestedBy ?? null,
        status: ServerCommandStatus.RUNNING,
        autoApproved: true,
        decidedAt: new Date(),
      },
    });
    let status: ServerCommandStatus = ServerCommandStatus.DONE;
    let output = '';
    let exitCode: number | null = null;
    try {
      const result = await sshExec(target, 'bash -s', {
        input: INVENTORY_SCRIPT,
        timeoutMs: 10 * 60_000,
        maxOutput: 90_000,
      });
      output = result.output;
      exitCode = result.exitCode;
      if (exitCode === null) status = ServerCommandStatus.FAILED;
    } catch (error) {
      status = ServerCommandStatus.FAILED;
      output = error instanceof Error ? error.message : String(error);
    }
    return this.prisma.serverCommand.update({
      where: { id: row.id },
      data: { status, output, exitCode, finishedAt: new Date() },
    });
  }

  // ── Interno ─────────────────────────────────────────────────────────────

  private async execute(
    row: ServerCommand,
    server: ServerConnection,
  ): Promise<ServerCommand> {
    const running = await this.prisma.serverCommand.update({
      where: { id: row.id },
      data: { status: ServerCommandStatus.RUNNING, decidedAt: new Date() },
    });
    if (row.updateId) {
      if (!this.updateRunner) {
        return this.finishUpdate(
          row.id,
          false,
          'As atualizações não estão disponíveis.',
        );
      }
      void this.updateRunner(running).catch((error: unknown) =>
        this.finishUpdate(
          row.id,
          false,
          error instanceof Error ? error.message : String(error),
        ),
      );
      return running;
    }
    // Antes de alterar uma máquina, o snapshot dela (não trava: se falhar, corre na mesma).
    const snapshot = row.autoApproved
      ? { name: null, note: '' }
      : await snapshotBeforeCommand(server, row.command, row.code);
    let status: ServerCommandStatus = ServerCommandStatus.DONE;
    let output = '';
    let exitCode: number | null = null;
    try {
      const result = await sshExec(this.target(server), row.command);
      output = snapshot.note + result.output;
      exitCode = result.exitCode;
      if (exitCode !== 0) status = ServerCommandStatus.FAILED;
    } catch (error) {
      status = ServerCommandStatus.FAILED;
      output =
        snapshot.note +
        (error instanceof Error ? error.message : String(error));
    }
    const finished = await this.prisma.serverCommand.update({
      where: { id: row.id },
      data: {
        status,
        output,
        exitCode,
        snapshotName: snapshot.name,
        finishedAt: new Date(),
      },
    });
    if (!row.autoApproved) await this.logCommand(finished, server);
    return finished;
  }

  /** Um comando que altera, no registo do dia do servidor (Documentos → Registos). */
  private async logCommand(row: ServerCommand, server: ServerConnection) {
    const ok = row.status === ServerCommandStatus.DONE;
    const output = (row.output ?? '').trim();
    const day = new Date().toLocaleDateString('sv-SE', {
      timeZone: 'Europe/Lisbon',
    });
    await this.docs
      .appendLog(
        row.userId,
        {
          title: `Registo · ${server.name} · ${day}`,
          summary: `Os comandos que alteraram o ${server.name} neste dia.`,
          tags: ['servidor', 'comandos'],
          links: [
            {
              type: DocLinkType.SERVER,
              targetId: server.id,
              label: server.name,
            },
          ],
          entry: [
            `${ok ? '✅' : '❌'} **Comando ${row.code}**${row.reason ? ` — ${row.reason}` : ''}`,
            `\`\`\`bash\n${row.command}\n\`\`\``,
            `Código de saída: ${row.exitCode ?? '—'}`,
            output
              ? `\`\`\`\n${output.length > 3000 ? `…${output.slice(-3000)}` : output}\n\`\`\``
              : '_(sem saída)_',
          ].join('\n\n'),
        },
        { kind: 'agent', key: row.requestedBy ?? 'infra' },
      )
      .catch(() => undefined);
  }

  private target(server: ServerConnection) {
    if (!server.sshPrivateKey || !server.sshUser) {
      throw new BadRequestException(
        `O ${server.name} não tem os comandos ligados. Liga-os em Apps ligadas → Proxmox → ${server.name} → Comandos.`,
      );
    }
    return {
      host: normalizeHost(server.host),
      port: server.sshPort,
      username: server.sshUser,
      privateKey: decryptToken(server.sshPrivateKey),
      verifyHostKey: (fingerprint: string) =>
        verifySshHostKey(server, fingerprint, this.hostKeys),
    };
  }

  async findServer(userId: string, serverId: string) {
    const server = await this.prisma.serverConnection.findFirst({
      where: { id: serverId, userId },
    });
    if (!server) throw new NotFoundException('Servidor não encontrado');
    return server;
  }

  /** Um servidor pelo nome (o que os agentes usam), ou o único que houver. */
  async findServerByName(
    userId: string,
    wanted?: string,
  ): Promise<ServerConnection | string> {
    const servers = await this.prisma.serverConnection.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
    if (!servers.length) {
      return 'Não há servidores ligados. Liga-os em Apps ligadas → Proxmox.';
    }
    if (!wanted?.trim()) {
      return servers.length === 1
        ? servers[0]
        : `Diz qual o servidor: ${servers.map((server) => server.name).join(', ')}.`;
    }
    const needle = wanted.trim().toLowerCase();
    return (
      servers.find((server) => server.name.toLowerCase() === needle) ??
      servers.find((server) => server.name.toLowerCase().includes(needle)) ??
      `Não há nenhum servidor "${wanted}". Os que existem: ${servers.map((server) => server.name).join(', ')}.`
    );
  }

  private async findCommand(userId: string, commandId: string) {
    const row = await this.prisma.serverCommand.findFirst({
      where: { id: commandId, userId },
    });
    if (!row) throw new NotFoundException('Comando não encontrado');
    return row;
  }
}
