import { BadRequestException, Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import Anthropic from '@anthropic-ai/sdk';
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
import { createApiClient, testApiKey } from './claudeApiClient';

const run = promisify(execFile);

export type AiProviderId = 'claude-code' | 'claude-api';

export interface AiCredentialView {
  provider: AiProviderId;
  /** Os últimos 4 do token ou da chave guardada; vazio = nenhum (no Claude Code, o login da máquina). */
  keyHint: string;
  usesMachineLogin: boolean;
  /** Se dá para o usar: o Claude Code tem sempre o login da máquina; a API precisa da chave. */
  configured: boolean;
  updatedAt: Date | null;
  isActive: boolean;
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

export const PROVIDER_OF: Record<AiProviderId, AiProvider> = {
  'claude-code': AiProvider.CLAUDE_CODE,
  'claude-api': AiProvider.CLAUDE_API,
};

const modelsOf = (row: AiCredential | null): AiModels => ({
  main: row?.mainModel ?? DEFAULT_MODELS.main,
  agent: row?.agentModel ?? DEFAULT_MODELS.agent,
});

const tokenOf = (row: AiCredential | null) =>
  row?.apiKey ? decryptToken(row.apiKey) : null;

/** A API só está em uso escolhida e com chave; tudo o resto é o Claude Code (como antes). */
const usesApi = (api: AiCredential | null) =>
  Boolean(api?.isActive && api.apiKey);

/**
 * A IA de cada utilizador, de um de dois fornecedores (só um em uso):
 * - o Claude Code desta máquina, com a subscrição dele: o login da máquina (`claude auth
 *   login`) ou um token de longa duração (`claude setup-token`);
 * - a API da Anthropic, com a chave dele (paga ao uso).
 * O token e a chave guardam-se cifrados e nunca voltam ao browser — só os últimos 4
 * caracteres. Cada fornecedor tem os seus modelos; o limite de custo é o do que está em uso.
 */
@Injectable()
export class AiCredentialService {
  constructor(private readonly prisma: PrismaService) {}

  private row(userId: string, provider: AiProvider) {
    return this.prisma.aiCredential.findUnique({
      where: { userId_provider: { userId, provider } },
    });
  }

  private async rows(userId: string) {
    const [code, api] = await Promise.all([
      this.row(userId, AiProvider.CLAUDE_CODE),
      this.row(userId, AiProvider.CLAUDE_API),
    ]);
    return { code, api };
  }

  async list(userId: string): Promise<AiCredentialView[]> {
    const { code, api } = await this.rows(userId);
    const apiInUse = usesApi(api);
    return [
      {
        provider: 'claude-code',
        keyHint: code?.keyHint ?? '',
        usesMachineLogin: !code?.apiKey,
        configured: true,
        updatedAt: code?.updatedAt ?? null,
        isActive: !apiInUse,
        models: modelsOf(code),
        defaultModels: DEFAULT_MODELS,
      },
      {
        provider: 'claude-api',
        keyHint: api?.keyHint ?? '',
        usesMachineLogin: false,
        configured: Boolean(api?.apiKey),
        updatedAt: api?.updatedAt ?? null,
        isActive: apiInUse,
        models: modelsOf(api),
        defaultModels: DEFAULT_MODELS,
      },
    ];
  }

  /** A IA em uso do utilizador, com a chave e os modelos escolhidos. Há sempre uma. */
  async getClient(userId: string): Promise<AiClient> {
    const { code, api } = await this.rows(userId);
    if (usesApi(api)) return createApiClient(tokenOf(api)!, modelsOf(api));
    return createAiClient(tokenOf(code), modelsOf(code));
  }

  async requireClient(userId: string): Promise<AiClient> {
    return this.getClient(userId);
  }

  /**
   * Guarda o token da subscrição do Claude Code depois de o testar: um pedido mínimo
   * (Haiku, pouco esforço) tem de passar com ele.
   */
  async save(userId: string, rawToken: string): Promise<AiCredentialView[]> {
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
    await this.store(userId, AiProvider.CLAUDE_CODE, token);
    return this.list(userId);
  }

  /**
   * Guarda a chave da API depois de a testar. Fica em uso só se o Claude Code não
   * estiver pronto (sem token nem login da máquina): quem já usa o Claude Code continua
   * nele e escolhe a API quando quiser.
   */
  async saveApiKey(
    userId: string,
    rawKey: string,
  ): Promise<AiCredentialView[]> {
    const key = rawKey.trim();
    try {
      await testApiKey(key);
    } catch (error) {
      throw new BadRequestException({
        provider: 'claude-api',
        code:
          error instanceof Anthropic.AuthenticationError ||
          error instanceof Anthropic.PermissionDeniedError
            ? AI_ERRORS.KEY_INVALID
            : AI_ERRORS.KEY_UNVERIFIED,
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível testar a chave.',
      });
    }
    await this.store(userId, AiProvider.CLAUDE_API, key);
    const code = await this.row(userId, AiProvider.CLAUDE_CODE);
    if (!code?.apiKey && !(await this.status(userId)).loggedIn) {
      await this.activate(userId, 'claude-api');
    }
    return this.list(userId);
  }

  private async store(userId: string, provider: AiProvider, secret: string) {
    const data = { apiKey: encryptToken(secret), keyHint: secret.slice(-4) };
    await this.prisma.aiCredential.upsert({
      where: { userId_provider: { userId, provider } },
      create: { userId, provider, ...data, isActive: false },
      update: data,
    });
  }

  /** Escolhe o fornecedor em uso (só um fica ativo). A API precisa de ter a chave. */
  async activate(
    userId: string,
    provider: AiProviderId,
  ): Promise<AiCredentialView[]> {
    const chosen = PROVIDER_OF[provider];
    if (chosen === AiProvider.CLAUDE_API) {
      const api = await this.row(userId, AiProvider.CLAUDE_API);
      if (!api?.apiKey) {
        throw new BadRequestException({
          code: AI_ERRORS.KEY_MISSING,
          message: 'Guarda primeiro a chave da API da Anthropic.',
        });
      }
    }
    await this.prisma.$transaction([
      this.prisma.aiCredential.updateMany({
        where: { userId, provider: { not: chosen } },
        data: { isActive: false },
      }),
      this.prisma.aiCredential.upsert({
        where: { userId_provider: { userId, provider: chosen } },
        create: {
          userId,
          provider: chosen,
          apiKey: '',
          keyHint: '',
          isActive: true,
        },
        update: { isActive: true },
      }),
    ]);
    return this.list(userId);
  }

  /** Os modelos de um fornecedor; vazio (ou o da app) volta ao da app. */
  async setModels(
    userId: string,
    models: Partial<AiModels>,
    provider: AiProviderId = 'claude-code',
  ): Promise<AiCredentialView[]> {
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
    const chosen = PROVIDER_OF[provider];
    const anyActive = await this.prisma.aiCredential.count({
      where: { userId, isActive: true },
    });
    await this.prisma.aiCredential.upsert({
      where: { userId_provider: { userId, provider: chosen } },
      create: {
        userId,
        provider: chosen,
        apiKey: '',
        keyHint: '',
        isActive: chosen === AiProvider.CLAUDE_CODE && anyActive === 0,
        ...data,
      },
      update: data,
    });
    return this.list(userId);
  }

  models(): string[] {
    return CLAUDE_CODE_MODELS;
  }

  /** Tira o token do Claude Code: volta ao login desta máquina (os modelos ficam). */
  async remove(userId: string): Promise<void> {
    const row = await this.row(userId, AiProvider.CLAUDE_CODE);
    if (!row) return;
    await this.prisma.aiCredential.update({
      where: { id: row.id },
      data: { apiKey: '', keyHint: '' },
    });
  }

  /** Tira a chave da API; se estava em uso, volta ao Claude Code. */
  async removeApiKey(userId: string): Promise<void> {
    const api = await this.row(userId, AiProvider.CLAUDE_API);
    if (!api) return;
    await this.prisma.aiCredential.update({
      where: { id: api.id },
      data: { apiKey: '', keyHint: '', isActive: false },
    });
    if (api.isActive) await this.activate(userId, 'claude-code');
  }

  /** Se o Claude Code está instalado e com sessão (lido agora, sem gastar nada). */
  async status(userId: string): Promise<ClaudeCodeStatus> {
    const token = tokenOf(await this.row(userId, AiProvider.CLAUDE_CODE));
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
