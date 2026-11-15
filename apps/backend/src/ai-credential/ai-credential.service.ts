import { BadRequestException, Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from 'src/prisma/prisma.service';
import { AiCredential, AiProvider } from 'src/generated/prisma/client/client';
import { encryptToken, decryptToken } from 'src/utils/crypto/token-cipher';
import {
  ClaudeCodeError,
  claudeBin,
  runClaudeCode,
} from 'src/claude-code/claudeCode.runner';
import { AI_ERRORS } from './ai-providers';
import {
  AiClient,
  AiModels,
  CLAUDE_CODE_MODELS,
  DEFAULT_MODELS,
  createAiClient,
} from './ai-client';

const run = promisify(execFile);

export interface AiCredentialView {
  provider: 'claude-code';
  /** Os últimos 4 do token guardado; vazio = o login desta máquina. */
  keyHint: string;
  usesMachineLogin: boolean;
  updatedAt: Date | null;
  isActive: true;
  models: AiModels;
  defaultModels: AiModels;
}

export interface ClaudeCodeStatus {
  installed: boolean;
  version: string | null;
  loggedIn: boolean;
  authMethod: string | null;
  subscription: string | null;
  expiresAt: string | null;
  usesToken: boolean;
  error: string | null;
}

const modelsOf = (row: AiCredential | null): AiModels => ({
  main: row?.mainModel ?? DEFAULT_MODELS.main,
  agent: row?.agentModel ?? DEFAULT_MODELS.agent,
});

const tokenOf = (row: AiCredential | null) =>
  row?.apiKey ? decryptToken(row.apiKey) : null;

/**
 * A IA de cada utilizador é o Claude Code desta máquina, com a subscrição dele:
 * o login da máquina (`claude auth login`) ou um token de longa duração
 * (`claude setup-token`), guardado cifrado como as outras chaves e nunca
 * devolvido ao browser — só os últimos 4 caracteres. Aqui também ficam os
 * modelos escolhidos e o limite de custo.
 */
@Injectable()
export class AiCredentialService {
  constructor(private readonly prisma: PrismaService) {}

  private row(userId: string) {
    return this.prisma.aiCredential.findUnique({
      where: {
        userId_provider: { userId, provider: AiProvider.CLAUDE_CODE },
      },
    });
  }

  async list(userId: string): Promise<AiCredentialView[]> {
    const row = await this.row(userId);
    return [
      {
        provider: 'claude-code',
        keyHint: row?.keyHint ?? '',
        usesMachineLogin: !row?.apiKey,
        updatedAt: row?.updatedAt ?? null,
        isActive: true,
        models: modelsOf(row),
        defaultModels: DEFAULT_MODELS,
      },
    ];
  }

  /** O Claude Code do utilizador, com o token e os modelos escolhidos. Há sempre um. */
  async getClient(userId: string): Promise<AiClient> {
    const row = await this.row(userId);
    return createAiClient(tokenOf(row), modelsOf(row));
  }

  async requireClient(userId: string): Promise<AiClient> {
    return this.getClient(userId);
  }

  /**
   * Guarda o token da subscrição depois de o testar: um pedido mínimo (Haiku,
   * pouco esforço) tem de passar com ele.
   */
  async save(userId: string, rawToken: string): Promise<AiCredentialView> {
    const token = rawToken.trim();
    try {
      await runClaudeCode({
        systemPrompt: 'Responde só "ok".',
        prompt: 'ok?',
        model: 'claude-haiku-5-5',
        effort: 'low',
        token,
        timeoutMs: 90_000,
      });
    } catch (error) {
      throw new BadRequestException({
        code:
          error instanceof ClaudeCodeError && error.code === 'NOT_LOGGED_IN'
            ? AI_ERRORS.KEY_INVALID
            : AI_ERRORS.KEY_UNVERIFIED,
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível testar o token.',
      });
    }
    const data = { apiKey: encryptToken(token), keyHint: token.slice(-4) };
    await this.prisma.aiCredential.upsert({
      where: {
        userId_provider: { userId, provider: AiProvider.CLAUDE_CODE },
      },
      create: {
        userId,
        provider: AiProvider.CLAUDE_CODE,
        ...data,
        isActive: true,
      },
      update: data,
    });
    return (await this.list(userId))[0];
  }

  /** Os modelos; vazio (ou o da app) volta ao da app. */
  async setModels(
    userId: string,
    models: Partial<AiModels>,
  ): Promise<AiCredentialView> {
    const pick = (value: string | undefined, fallback: string) =>
      value === undefined
        ? undefined
        : value.trim() && value.trim() !== fallback
          ? value.trim()
          : null;
    const data = {
      mainModel: pick(models.main, DEFAULT_MODELS.main),
      agentModel: pick(models.agent, DEFAULT_MODELS.agent),
    };
    await this.prisma.aiCredential.upsert({
      where: {
        userId_provider: { userId, provider: AiProvider.CLAUDE_CODE },
      },
      create: {
        userId,
        provider: AiProvider.CLAUDE_CODE,
        apiKey: '',
        keyHint: '',
        isActive: true,
        ...data,
      },
      update: data,
    });
    return (await this.list(userId))[0];
  }

  models(): string[] {
    return CLAUDE_CODE_MODELS;
  }

  /** Tira o token: volta ao login desta máquina (os modelos ficam). */
  async remove(userId: string): Promise<void> {
    const row = await this.row(userId);
    if (!row) return;
    await this.prisma.aiCredential.update({
      where: { id: row.id },
      data: { apiKey: '', keyHint: '' },
    });
  }

  /** Se o Claude Code está instalado e com sessão (lido agora, sem gastar nada). */
  async status(userId: string): Promise<ClaudeCodeStatus> {
    const token = tokenOf(await this.row(userId));
    const env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      USERPROFILE: process.env.USERPROFILE,
      APPDATA: process.env.APPDATA,
      LOCALAPPDATA: process.env.LOCALAPPDATA,
      SYSTEMROOT: process.env.SYSTEMROOT,
      ...(token ? { CLAUDE_CODE_OAUTH_TOKEN: token } : {}),
    };
    const status: ClaudeCodeStatus = {
      installed: false,
      version: null,
      loggedIn: false,
      authMethod: null,
      subscription: null,
      expiresAt: null,
      usesToken: Boolean(token),
      error: null,
    };
    try {
      const { stdout } = await run(claudeBin(), ['--version'], {
        env,
        timeout: 20_000,
        windowsHide: true,
      });
      status.installed = true;
      status.version = stdout.trim().split(/\s/)[0] || null;
    } catch {
      status.error = 'O Claude Code não está instalado nesta máquina.';
      return status;
    }
    try {
      const { stdout } = await run(claudeBin(), ['auth', 'status'], {
        env,
        timeout: 20_000,
        windowsHide: true,
      });
      const auth = JSON.parse(stdout) as Record<string, unknown>;
      status.loggedIn = Boolean(auth.loggedIn);
      status.authMethod =
        typeof auth.authMethod === 'string' ? auth.authMethod : null;
      status.subscription =
        typeof auth.subscriptionType === 'string'
          ? auth.subscriptionType
          : null;
      status.expiresAt =
        typeof auth.loginExpiresAt === 'string' ? auth.loginExpiresAt : null;
    } catch (error) {
      status.error =
        error instanceof Error ? error.message.slice(0, 300) : String(error);
    }
    return status;
  }
}
