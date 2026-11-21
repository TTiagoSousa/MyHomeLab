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
import { createGameTrackerAccount } from './helpers/createGameTrackerAccount';
import { refreshGameTrackerAccount } from './helpers/refreshGameTrackerAccount';
import { CreateGameTrackerAccountDto } from './dto/create-gametracker-account.dto';
import { createImmichAccount } from './helpers/createImmichAccount';
import { refreshImmichAccount } from './helpers/refreshImmichAccount';
import { CreateImmichAccountDto } from './dto/create-immich-account.dto';
import { createPaperlessAccount } from './helpers/createPaperlessAccount';
import { refreshPaperlessAccount } from './helpers/refreshPaperlessAccount';
import { CreatePaperlessAccountDto } from './dto/create-paperless-account.dto';
import { CreateStirlingAccountDto } from './dto/create-stirling-account.dto';
import { createStirlingAccount } from './helpers/createStirlingAccount';
import { refreshStirlingAccount } from './helpers/refreshStirlingAccount';
import { CreatePlaneAccountDto } from './dto/create-plane-account.dto';
import { createPlaneAccount } from './helpers/createPlaneAccount';
import { refreshPlaneAccount } from './helpers/refreshPlaneAccount';
import { CreateGiteaMirrorAccountDto } from './dto/create-gitea-mirror-account.dto';
import { createGiteaMirrorAccount } from './helpers/createGiteaMirrorAccount';
import { refreshGiteaMirrorAccount } from './helpers/refreshGiteaMirrorAccount';
import { CreateInfisicalAccountDto } from './dto/create-infisical-account.dto';
import { createInfisicalAccount } from './helpers/createInfisicalAccount';
import { refreshInfisicalAccount } from './helpers/refreshInfisicalAccount';
import { CreateVaultwardenAccountDto } from './dto/create-vaultwarden-account.dto';
import { createVaultwardenAccount } from './helpers/createVaultwardenAccount';
import { refreshVaultwardenAccount } from './helpers/refreshVaultwardenAccount';
import { CreatePostgresAccountDto } from './dto/create-postgres-account.dto';
import { createPostgresAccount } from './helpers/createPostgresAccount';
import { refreshPostgresAccount } from './helpers/refreshPostgresAccount';
import { CreateClickHouseAccountDto } from './dto/create-clickhouse-account.dto';
import { createClickHouseAccount } from './helpers/createClickHouseAccount';
import { refreshClickHouseAccount } from './helpers/refreshClickHouseAccount';
import { CreateNginxProxyManagerAccountDto } from './dto/create-nginx-proxy-manager-account.dto';
import { CreateTplinkRouterAccountDto } from './dto/create-tplink-router-account.dto';
import { TplinkRouterActionDto } from './dto/tplink-router-action.dto';
import { createTplinkRouterAccount } from './helpers/createTplinkRouterAccount';
import { refreshTplinkRouterAccount } from './helpers/refreshTplinkRouterAccount';
import { runTplinkRouterAction } from './helpers/runTplinkRouterAction';
import { reconnectDueTplinkRouters } from 'src/tplink-router/tplink-router.client';
import { createNginxProxyManagerAccount } from './helpers/createNginxProxyManagerAccount';
import { refreshNginxProxyManagerAccount } from './helpers/refreshNginxProxyManagerAccount';
import { CreateCoolifyAccountDto } from './dto/create-coolify-account.dto';
import { createCoolifyAccount } from './helpers/createCoolifyAccount';
import { refreshCoolifyAccount } from './helpers/refreshCoolifyAccount';
import { CreateDispatcharrAccountDto } from './dto/create-dispatcharr-account.dto';
import { createDispatcharrAccount } from './helpers/createDispatcharrAccount';
import { refreshDispatcharrAccount } from './helpers/refreshDispatcharrAccount';
import { CreateJellyfinAccountDto } from './dto/create-jellyfin-account.dto';
import { createJellyfinAccount } from './helpers/createJellyfinAccount';
import { refreshJellyfinAccount } from './helpers/refreshJellyfinAccount';
import { createSolidtimeAccount } from './helpers/createSolidtimeAccount';
import { refreshSolidtimeAccount } from './helpers/refreshSolidtimeAccount';
import { CreateSolidtimeAccountDto } from './dto/create-solidtime-account.dto';
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

  async createGameTracker(dto: CreateGameTrackerAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    const account = await this.afterConnect(
      await createGameTrackerAccount(
        dto,
        userId,
        this.connectedAccountRepository,
      ),
      dto,
    );
    void this.checkVersion(account);
    return account;
  }

  /** O estado do GamesTracker (utilizador do token, a prateleira) e a versão. */
  async gameTrackerStatus(id: string, userId: string) {
    const status = await refreshGameTrackerAccount(
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
      total: status.total,
      playing: status.playing,
      finished: status.finished,
      planned: status.planned,
      hours: status.hours,
      rating: status.rating,
      version: account.appVersion,
      latestVersion: account.appLatestVersion,
      latestUrl: account.appLatestUrl,
    };
  }

  async createImmich(dto: CreateImmichAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    const account = await this.afterConnect(
      await createImmichAccount(dto, userId, this.connectedAccountRepository),
      dto,
    );
    void this.checkVersion(account);
    return account;
  }

  async createPaperless(dto: CreatePaperlessAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    const account = await this.afterConnect(
      await createPaperlessAccount(
        dto,
        userId,
        this.connectedAccountRepository,
      ),
      dto,
    );
    void this.checkVersion(account);
    return account;
  }

  async createStirling(dto: CreateStirlingAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    const account = await this.afterConnect(
      await createStirlingAccount(dto, userId, this.connectedAccountRepository),
      dto,
    );
    void this.checkVersion(account);
    return account;
  }

  /** O estado do Stirling-PDF (versão, operações, administrador, MCP) e a versão nova. */
  async stirlingStatus(id: string, userId: string) {
    const { account: checked, ...status } = await refreshStirlingAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    const account = await checkAppVersion(
      checked,
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

  async createPlane(dto: CreatePlaneAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    return this.afterConnect(
      await createPlaneAccount(dto, userId, this.connectedAccountRepository),
      dto,
    );
  }

  /** O estado do Plane e a versão (de /api/instances/). */
  async planeStatus(id: string, userId: string) {
    const { account: checked, ...status } = await refreshPlaneAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    const account = await checkAppVersion(
      checked,
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

  async createGiteaMirror(dto: CreateGiteaMirrorAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    return this.afterConnect(
      await createGiteaMirrorAccount(
        dto,
        userId,
        this.connectedAccountRepository,
      ),
      dto,
    );
  }

  /** O estado do Gitea Mirror e a versão (de /api/health). */
  async giteaMirrorStatus(id: string, userId: string) {
    const { account: checked, ...status } = await refreshGiteaMirrorAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    const account = await checkAppVersion(
      checked,
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

  async createJellyfin(dto: CreateJellyfinAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    return this.afterConnect(
      await createJellyfinAccount(dto, userId, this.connectedAccountRepository),
      dto,
    );
  }

  /** O estado do Jellyfin e a versão. */
  async jellyfinStatus(id: string, userId: string) {
    const { account: checked, ...status } = await refreshJellyfinAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    const account = await checkAppVersion(
      checked,
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

  async createDispatcharr(dto: CreateDispatcharrAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    return this.afterConnect(
      await createDispatcharrAccount(
        dto,
        userId,
        this.connectedAccountRepository,
      ),
      dto,
    );
  }

  /** O estado do Dispatcharr e a versão. */
  async dispatcharrStatus(id: string, userId: string) {
    const { account: checked, ...status } = await refreshDispatcharrAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    const account = await checkAppVersion(
      checked,
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

  async createCoolify(dto: CreateCoolifyAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    return this.afterConnect(
      await createCoolifyAccount(dto, userId, this.connectedAccountRepository),
      dto,
    );
  }

  /** O estado do Coolify e a versão. */
  async coolifyStatus(id: string, userId: string) {
    const { account: checked, ...status } = await refreshCoolifyAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    const account = await checkAppVersion(
      checked,
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

  async createNginxProxyManager(
    dto: CreateNginxProxyManagerAccountDto,
    userId: string,
  ) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    return this.afterConnect(
      await createNginxProxyManagerAccount(
        dto,
        userId,
        this.connectedAccountRepository,
      ),
      dto,
    );
  }

  /** O estado do Nginx Proxy Manager e a versão. */
  async nginxProxyManagerStatus(id: string, userId: string) {
    const { account: checked, ...status } =
      await refreshNginxProxyManagerAccount(
        id,
        userId,
        this.connectedAccountRepository,
      );
    const account = await checkAppVersion(
      checked,
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

  async createTplinkRouter(dto: CreateTplinkRouterAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    return this.afterConnect(
      await createTplinkRouterAccount(
        dto,
        userId,
        this.connectedAccountRepository,
      ),
      dto,
    );
  }

  /** O router agora e a ligação a ele (desligado não é um erro). */
  async tplinkRouterStatus(id: string, userId: string, force = false) {
    const { account, ...status } = await refreshTplinkRouterAccount(
      id,
      userId,
      this.connectedAccountRepository,
      force,
    );
    return { ...status, version: account.appVersion };
  }

  tplinkRouterAction(id: string, userId: string, dto: TplinkRouterActionDto) {
    return runTplinkRouterAction(
      id,
      userId,
      this.connectedAccountRepository,
      dto,
    );
  }

  /** De minuto a minuto: volta a ligar os routers desligados cuja próxima tentativa já chegou. */
  async reconnectTplinkRouters() {
    const accounts = await this.connectedAccountRepository.findAllByProviders([
      ConnectionProvider.TPLINK_ROUTER,
    ]);
    await reconnectDueTplinkRouters(
      new Set(
        accounts
          .filter((account) => account.isActive)
          .map((account) => account.id),
      ),
    );
  }

  async createClickHouse(dto: CreateClickHouseAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    return this.afterConnect(
      await createClickHouseAccount(
        dto,
        userId,
        this.connectedAccountRepository,
      ),
      dto,
    );
  }

  /** O estado do ClickHouse e a versão. */
  async clickhouseStatus(id: string, userId: string) {
    const { account: checked, ...status } = await refreshClickHouseAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    const account = await checkAppVersion(
      checked,
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

  async createPostgres(dto: CreatePostgresAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    return this.afterConnect(
      await createPostgresAccount(dto, userId, this.connectedAccountRepository),
      dto,
    );
  }

  /** O estado do PostgreSQL. */
  async postgresStatus(id: string, userId: string) {
    const { account: checked, ...status } = await refreshPostgresAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    return {
      ...status,
      version:
        (status as { serverVersion?: string }).serverVersion ??
        checked.appVersion,
    };
  }

  async createVaultwarden(dto: CreateVaultwardenAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    return this.afterConnect(
      await createVaultwardenAccount(
        dto,
        userId,
        this.connectedAccountRepository,
      ),
      dto,
    );
  }

  /** O estado do Vaultwarden e a versão. */
  async vaultwardenStatus(id: string, userId: string) {
    const { account: checked, ...status } = await refreshVaultwardenAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    const account = await checkAppVersion(
      checked,
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

  async createInfisical(dto: CreateInfisicalAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    return this.afterConnect(
      await createInfisicalAccount(
        dto,
        userId,
        this.connectedAccountRepository,
      ),
      dto,
    );
  }

  /** O estado do Infisical. */
  async infisicalStatus(id: string, userId: string) {
    const { account: checked, ...status } = await refreshInfisicalAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    return {
      ...status,
      version:
        (status as { serverVersion?: string }).serverVersion ??
        checked.appVersion,
    };
  }

  async createSolidtime(dto: CreateSolidtimeAccountDto, userId: string) {
    await assertOwnServer(
      userId,
      dto.serverConnectionId,
      this.connectedAccountRepository,
    );
    return this.afterConnect(
      await createSolidtimeAccount(
        dto,
        userId,
        this.connectedAccountRepository,
      ),
      dto,
    );
  }

  /** O estado do solidtime (a API não diz a versão instalada: não há avisos de versão). */
  async solidtimeStatus(id: string, userId: string) {
    const { account, ...status } = await refreshSolidtimeAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    return { ...status, version: account.appVersion };
  }

  /** O estado do Paperless (utilizador do token, documentos, caixa de entrada, saúde) e a versão. */
  async paperlessStatus(id: string, userId: string) {
    const { account: checked, ...status } = await refreshPaperlessAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    const account = await checkAppVersion(
      checked,
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

  /** O estado do Immich (utilizador e permissões da chave, fotos, disco, filas) e a versão. */
  async immichStatus(id: string, userId: string) {
    const { account: checked, ...status } = await refreshImmichAccount(
      id,
      userId,
      this.connectedAccountRepository,
    );
    const account = await checkAppVersion(
      checked,
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

  /** O afterConnect para quem não verifica a versão logo: devolve já a vista sem segredos. */
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
