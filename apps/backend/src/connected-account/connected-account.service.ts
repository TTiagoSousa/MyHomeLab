import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaConnectedAccountRepository } from './repositories/prisma/prisma-connected-account-repository';
import { listConnectedAccounts } from './helpers/listConnectedAccounts';
import { buildGoogleAuthUrl } from './helpers/buildGoogleAuthUrl';
import { GoogleConnectionKind } from './google/google-oauth.client';
import { handleGoogleCallback } from './helpers/handleGoogleCallback';
import { deleteConnectedAccount } from './helpers/deleteConnectedAccount';
import { updateConnectedAccount } from './helpers/updateConnectedAccount';
import { assertOwnServer } from './helpers/assertOwnServer';
import { AppLocationDto } from './dto/app-location.dto';
import { appLabel } from 'src/docs/docs.service';
import { createNextcloudAccount } from './helpers/createNextcloudAccount';
import { refreshNextcloudAccount } from './helpers/refreshNextcloudAccount';
import { createForgejoAccount } from './helpers/createForgejoAccount';
import { refreshForgejoAccount } from './helpers/refreshForgejoAccount';
import { createTrekAccount } from './helpers/createTrekAccount';
import { refreshTrekAccount } from './helpers/refreshTrekAccount';
import { CreateTrekAccountDto } from './dto/create-trek-account.dto';
import { createOpenGymAccount } from './helpers/createOpenGymAccount';
import { refreshOpenGymAccount } from './helpers/refreshOpenGymAccount';
import { CreateOpenGymAccountDto } from './dto/create-opengym-account.dto';
import { SetTrekMcpDto } from './dto/set-trek-mcp.dto';
import { setTrekMcp } from './helpers/setTrekMcp';
import { SetOpenGymMcpDto } from './dto/set-opengym-mcp.dto';
import { setOpenGymMcp } from './helpers/setOpenGymMcp';
import { openGymMcpOf, openGymMcpTools } from 'src/opengym/openGymMcp.client';
import { findConnectedAccount } from './helpers/findConnectedAccount';
import {
  isReadOnlyTool,
  trekMcpOf,
  trekMcpTools,
} from 'src/trek/trekMcp.client';
import { toHttpError } from 'src/integrations/app-integration.error';
import { createHomeAssistantAccount } from './helpers/createHomeAssistantAccount';
import { refreshHomeAssistantAccount } from './helpers/refreshHomeAssistantAccount';
import { CreateHomeAssistantAccountDto } from './dto/create-home-assistant-account.dto';
import { createAdguardAccount } from './helpers/createAdguardAccount';
import { refreshAdguardAccount } from './helpers/refreshAdguardAccount';
import { CreateAdguardAccountDto } from './dto/create-adguard-account.dto';
import { SetAdguardSettingsDto } from './dto/set-adguard-settings.dto';
import { setAdguardSettings } from './helpers/setAdguardSettings';
import { refreshAdguardFilters } from './helpers/refreshAdguardFilters';
import { VERSION_SOURCES, checkAppVersion } from './helpers/checkAppVersion';
import { NotificationService } from 'src/notification/notification.service';
import { AppUpdateService } from 'src/app-update/app-update.service';
import { CreateForgejoAccountDto } from './dto/create-forgejo-account.dto';
import { getGmailStats } from './helpers/getGmailStats';
import { listAccountUpdates } from './helpers/listAccountUpdates';
import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import { UpdateConnectedAccountDto } from './dto/update-connected-account.dto';
import { CreateNextcloudAccountDto } from './dto/create-nextcloud-account.dto';

@Injectable()
export class ConnectedAccountService {
  constructor(
    private readonly connectedAccountRepository: PrismaConnectedAccountRepository,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationService,
    private readonly updates: AppUpdateService,
  ) {}

  async findAll(userId: string, provider?: ConnectionProvider) {
    return listConnectedAccounts(
      userId,
      this.connectedAccountRepository,
      provider,
    );
  }

  buildGoogleAuthUrl(userId: string, kind: GoogleConnectionKind) {
    return buildGoogleAuthUrl(userId, kind, this.jwt);
  }

  async handleGoogleCallback(code: string, state: string) {
    return handleGoogleCallback(
      code,
      state,
      this.jwt,
      this.connectedAccountRepository,
    );
  }

  async remove(id: string, userId: string) {
    await deleteConnectedAccount(id, userId, this.connectedAccountRepository);
    await this.notifications.resolveConnectedAccount(id);
    await this.updates.cancelForAccount(id);
  }

  async update(id: string, userId: string, dto: UpdateConnectedAccountDto) {
    return updateConnectedAccount(
      id,
      userId,
      dto,
      this.connectedAccountRepository,
    );
  }

  async createNextcloud(dto: CreateNextcloudAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    const account = await createNextcloudAccount(
      dto,
      userId,
      this.connectedAccountRepository,
    );
    const connected = await this.afterConnect(account, dto);
    void this.checkVersion(connected);
    return connected;
  }

  /**
   * O estado do Nextcloud (conta, admin, manutenção, apps com versão nova) e a
   * versão do servidor; as apps com versão nova viram atualizações próprias.
   */
  async nextcloudStatus(id: string, userId: string) {
    const { account: stored, ...status } = await refreshNextcloudAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    // Antes de responder: o "Verificar" mostra logo as atualizações das apps.
    await this.updates.checkNextcloudApps(stored).catch(() => undefined);
    const account = await checkAppVersion(
      stored,
      this.connectedAccountRepository,
      this.notifications,
      this.updates,
    );
    return {
      ...status,
      version: account.appVersion,
      latestVersion: account.appLatestVersion,
      latestUrl: account.appLatestUrl,
    };
  }

  async createForgejo(dto: CreateForgejoAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    const account = await this.afterConnect(
      await createForgejoAccount(dto, userId, this.connectedAccountRepository),
      dto,
    );
    void this.checkVersion(account);
    return account;
  }

  /** O estado da conta Forgejo e, já agora, a versão (abre o aviso se houver nova). */
  async forgejoStatus(id: string, userId: string) {
    const status = await refreshForgejoAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    const account = await checkAppVersion(
      status.account,
      this.connectedAccountRepository,
      this.notifications,
      this.updates,
    );
    return {
      login: status.login,
      isAdmin: status.isAdmin,
      repositories: status.repositories,
      privateRepositories: status.privateRepositories,
      version: account.appVersion,
      latestVersion: account.appLatestVersion,
      latestUrl: account.appLatestUrl,
    };
  }

  async createTrek(dto: CreateTrekAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    const account = await this.afterConnect(
      await createTrekAccount(dto, userId, this.connectedAccountRepository),
      dto,
    );
    void this.checkVersion(account);
    return account;
  }

  /** O estado do TREK (registo aberto, logins, backups lá dentro) e a versão. */
  async trekStatus(id: string, userId: string) {
    const status = await refreshTrekAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    const account = await checkAppVersion(
      status.account,
      this.connectedAccountRepository,
      this.notifications,
      this.updates,
    );
    return {
      registrationOpen: status.registrationOpen,
      requireMfa: status.requireMfa,
      login: status.login,
      trekBackups: status.trekBackups,
      mcp: status.mcp,
      version: account.appVersion,
      latestVersion: account.appLatestVersion,
      latestUrl: account.appLatestUrl,
    };
  }

  /** Liga, troca ou tira o cliente máquina do MCP do TREK (a API toda para os agentes). */
  setTrekMcp(id: string, userId: string, dto: SetTrekMcpDto) {
    return setTrekMcp(id, userId, dto, this.connectedAccountRepository);
  }

  /** As ferramentas do MCP do TREK (a página Ligações), lidas na hora. */
  async trekTools(id: string, userId: string) {
    const account = await findConnectedAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    const credentials = trekMcpOf(account);
    if (!credentials) return { connected: false, tools: [] };
    try {
      const tools = await trekMcpTools(credentials, true);
      return {
        connected: true,
        tools: tools.map((tool) => ({
          name: tool.name,
          title: tool.title ?? tool.annotations?.title ?? null,
          description: tool.description ?? '',
          readOnly: isReadOnlyTool(tool),
          destructive: Boolean(tool.annotations?.destructiveHint),
        })),
      };
    } catch (error) {
      throw toHttpError(error);
    }
  }

  async createOpenGym(dto: CreateOpenGymAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    const account = await this.afterConnect(
      await createOpenGymAccount(dto, userId, this.connectedAccountRepository),
      dto,
    );
    void this.checkVersion(account);
    return account;
  }

  /** O estado do openGym (servidor, perfil, rotinas e treinos) e a versão. */
  async openGymStatus(id: string, userId: string) {
    const status = await refreshOpenGymAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    const account = await checkAppVersion(
      status.account,
      this.connectedAccountRepository,
      this.notifications,
      this.updates,
    );
    return {
      profile: status.profile,
      isAdmin: status.isAdmin,
      writable: status.writable,
      users: status.users,
      routines: status.routines,
      workouts: status.workouts,
      lastWorkout: status.lastWorkout,
      plannedDays: status.plannedDays,
      tokenExpiresAt: status.tokenExpiresAt,
      mcp: await this.openGymMcpStatus(account),
      version: account.appVersion,
      latestVersion: account.appLatestVersion,
      latestUrl: account.appLatestUrl,
    };
  }

  /** Se o MCP do openGym tem token e entra (quantas ferramentas), sem falhar o estado. */
  private async openGymMcpStatus(account: ConnectedAccount) {
    const mcp = openGymMcpOf(account);
    if (!mcp) return { configured: false, tools: 0, error: null };
    try {
      return {
        configured: true,
        tools: (await openGymMcpTools(mcp)).length,
        error: null,
      };
    } catch (error) {
      return {
        configured: true,
        tools: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /** Liga, troca ou tira o token de API do MCP do openGym (os agentes no Claude Code). */
  setOpenGymMcp(id: string, userId: string, dto: SetOpenGymMcpDto) {
    return setOpenGymMcp(id, userId, dto, this.connectedAccountRepository);
  }

  async createHomeAssistant(
    dto: CreateHomeAssistantAccountDto,
    userId: string,
  ) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    const account = await this.afterConnect(
      await createHomeAssistantAccount(
        dto,
        userId,
        this.connectedAccountRepository,
      ),
      dto,
    );
    void this.checkVersion(account);
    return account;
  }

  /** O estado do Home Assistant (dono do token, o que lá existe) e a versão. */
  async homeAssistantStatus(id: string, userId: string) {
    const { account: stored, ...status } = await refreshHomeAssistantAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    void this.updates
      .checkHomeAssistantComponents(stored)
      .catch(() => undefined);
    const account = await checkAppVersion(
      stored,
      this.connectedAccountRepository,
      this.notifications,
      this.updates,
    );
    return {
      ...status,
      version: account.appVersion,
      latestVersion: account.appLatestVersion,
      latestUrl: account.appLatestUrl,
    };
  }

  async createAdguard(dto: CreateAdguardAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    const account = await this.afterConnect(
      await createAdguardAccount(dto, userId, this.connectedAccountRepository),
      dto,
    );
    void this.checkVersion(account);
    return account;
  }

  /** O estado do AdGuard (proteção, pedidos, listas, regras) e a versão. */
  async adguardStatus(id: string, userId: string) {
    const { account: stored, ...status } = await refreshAdguardAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    const account = await checkAppVersion(
      stored,
      this.connectedAccountRepository,
      this.notifications,
      this.updates,
    );
    return {
      ...status,
      version: account.appVersion,
      latestVersion: account.appLatestVersion,
      latestUrl: account.appLatestUrl,
    };
  }

  /** As definições manuais do AdGuard (o intervalo das listas), guardadas nele. */
  setAdguardSettings(id: string, userId: string, dto: SetAdguardSettingsDto) {
    return setAdguardSettings(id, userId, dto, this.connectedAccountRepository);
  }

  /** Descarrega já as listas de bloqueio do AdGuard. */
  refreshAdguardFilters(id: string, userId: string) {
    return refreshAdguardFilters(id, userId, this.connectedAccountRepository);
  }

  /** De 6 em 6 horas: as versões de todas as apps ligadas que as dizem. */
  async checkAllVersions() {
    const accounts = await this.connectedAccountRepository.findAllByProviders(
      Object.keys(VERSION_SOURCES) as ConnectionProvider[],
    );
    for (const account of accounts) await this.checkVersion(account);
  }

  /**
   * Logo a seguir a ligar: se disse onde a app corre, fica marcada (e entra em
   * Serviços); se é a mesma app que já esteve ligada, os documentos dela voltam.
   */
  private async afterConnect(
    account: ConnectedAccount,
    location: AppLocationDto,
  ): Promise<ConnectedAccount> {
    await this.connectedAccountRepository.inheritDocLinks(
      account,
      appLabel(account),
    );
    if (!location.serverConnectionId) return account;
    return this.connectedAccountRepository.update(account.id, {
      serverConnectionId: location.serverConnectionId,
      guestVmid: location.guestVmid ?? null,
    });
  }

  private async checkVersion(account: ConnectedAccount) {
    await checkAppVersion(
      account,
      this.connectedAccountRepository,
      this.notifications,
      this.updates,
    ).catch(() => undefined);
    await this.updates
      .checkHomeAssistantComponents(account)
      .catch(() => undefined);
    await this.updates.checkNextcloudApps(account).catch(() => undefined);
  }

  async getGmailStats(id: string, userId: string) {
    return getGmailStats(id, userId, this.connectedAccountRepository);
  }

  async listUpdates(id: string, userId: string) {
    return listAccountUpdates(id, userId, this.connectedAccountRepository);
  }
}
