import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConnectedAccountService } from './connected-account.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { ConnectionProvider } from 'src/generated/prisma/client/client';
import { UpdateConnectedAccountDto } from './dto/update-connected-account.dto';
import { CreateNextcloudAccountDto } from './dto/create-nextcloud-account.dto';
import { CreateForgejoAccountDto } from './dto/create-forgejo-account.dto';
import { CreateOpenGymAccountDto } from './dto/create-opengym-account.dto';
import { CreateGameTrackerAccountDto } from './dto/create-gametracker-account.dto';
import { CreateImmichAccountDto } from './dto/create-immich-account.dto';
import { CreatePaperlessAccountDto } from './dto/create-paperless-account.dto';
import { CreateStirlingAccountDto } from './dto/create-stirling-account.dto';
import { CreateSolidtimeAccountDto } from './dto/create-solidtime-account.dto';
import { CreatePlaneAccountDto } from './dto/create-plane-account.dto';
import { CreateGiteaMirrorAccountDto } from './dto/create-gitea-mirror-account.dto';
import { CreateInfisicalAccountDto } from './dto/create-infisical-account.dto';
import { CreateVaultwardenAccountDto } from './dto/create-vaultwarden-account.dto';
import { CreatePostgresAccountDto } from './dto/create-postgres-account.dto';
import { CreateClickHouseAccountDto } from './dto/create-clickhouse-account.dto';
import { CreateNginxProxyManagerAccountDto } from './dto/create-nginx-proxy-manager-account.dto';
import { CreateCoolifyAccountDto } from './dto/create-coolify-account.dto';
import { CreateDispatcharrAccountDto } from './dto/create-dispatcharr-account.dto';
import { CreateJellyfinAccountDto } from './dto/create-jellyfin-account.dto';
import { CreateTrekAccountDto } from './dto/create-trek-account.dto';
import { SetTrekMcpDto } from './dto/set-trek-mcp.dto';
import { SetOpenGymMcpDto } from './dto/set-opengym-mcp.dto';
import { CreateHomeAssistantAccountDto } from './dto/create-home-assistant-account.dto';
import { CreateAdguardAccountDto } from './dto/create-adguard-account.dto';
import { CreateTplinkRouterAccountDto } from './dto/create-tplink-router-account.dto';
import { TplinkRouterActionDto } from './dto/tplink-router-action.dto';
import { SetAdguardSettingsDto } from './dto/set-adguard-settings.dto';
import { googleKind } from './google/google-oauth.client';

@Controller('connected-account')
export class ConnectedAccountController {
  constructor(
    private readonly connectedAccountService: ConnectedAccountService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Query('provider') provider: ConnectionProvider | undefined,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.findAll(req.user.id, provider);
  }

  @UseGuards(JwtAuthGuard)
  @Get('google/connect')
  connectGoogle(
    @Query('kind') kind: string | undefined,
    @Req() req: Request & { user: JwtPayload },
    @Res() res: Response,
  ) {
    const url = this.connectedAccountService.buildGoogleAuthUrl(
      req.user.id,
      googleKind(kind),
    );
    res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') providerError: string | undefined,
    @Res() res: Response,
  ) {
    const { kind, error } =
      await this.connectedAccountService.handleGoogleCallback(
        code,
        state,
        providerError,
      );
    // Volta à página de onde se ligou: a do Gmail, a do Google Tasks ou a do Drive
    // (com ?google=cancelled|failed quando não ficou ligada, para a página o dizer).
    const page =
      kind === 'tasks'
        ? 'GoogleTasks'
        : kind === 'drive'
          ? 'GoogleDrive'
          : 'Gmail';
    res.redirect(
      `${process.env.FRONTEND_URL}/MyHomeLab/Apps/${page}${error ? `?google=${error}` : ''}`,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('nextcloud')
  connectNextcloud(
    @Body() dto: CreateNextcloudAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createNextcloud(dto, req.user.id);
  }

  /** O estado do Nextcloud agora (conta, admin, manutenção, apps com versão nova). */
  @UseGuards(JwtAuthGuard)
  @Get(':id/nextcloud-status')
  nextcloudStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.nextcloudStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('forgejo')
  connectForgejo(
    @Body() dto: CreateForgejoAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createForgejo(dto, req.user.id);
  }

  /** O estado da conta Forgejo agora (token, admin, repositórios). */
  @UseGuards(JwtAuthGuard)
  @Get(':id/forgejo-status')
  forgejoStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.forgejoStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('gametracker')
  connectGameTracker(
    @Body() dto: CreateGameTrackerAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createGameTracker(dto, req.user.id);
  }

  /** O estado do GamesTracker agora (utilizador do token, a prateleira, a versão). */
  @UseGuards(JwtAuthGuard)
  @Get(':id/gametracker-status')
  gameTrackerStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.gameTrackerStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('immich')
  connectImmich(
    @Body() dto: CreateImmichAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createImmich(dto, req.user.id);
  }

  /** O estado do Immich agora (utilizador e permissões da chave, fotos, disco, filas, versão). */
  @UseGuards(JwtAuthGuard)
  @Get(':id/immich-status')
  immichStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.immichStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('paperless')
  connectPaperless(
    @Body() dto: CreatePaperlessAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createPaperless(dto, req.user.id);
  }

  /** O estado do Paperless agora (utilizador do token, documentos, caixa de entrada, saúde, versão). */
  @UseGuards(JwtAuthGuard)
  @Get(':id/paperless-status')
  paperlessStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.paperlessStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('stirling')
  connectStirling(
    @Body() dto: CreateStirlingAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createStirling(dto, req.user.id);
  }

  /** O estado do Stirling-PDF agora (versão, operações, administrador, MCP). */
  @UseGuards(JwtAuthGuard)
  @Get(':id/stirling-status')
  stirlingStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.stirlingStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('solidtime')
  connectSolidtime(
    @Body() dto: CreateSolidtimeAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createSolidtime(dto, req.user.id);
  }

  /** O estado do solidtime agora (utilizador, organização, papel, cronómetro, horas da semana). */
  @UseGuards(JwtAuthGuard)
  @Get(':id/solidtime-status')
  solidtimeStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.solidtimeStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('plane')
  connectPlane(
    @Body() dto: CreatePlaneAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createPlane(dto, req.user.id);
  }

  /** O estado do Plane agora (utilizador, espaço, projetos, versão). */
  @UseGuards(JwtAuthGuard)
  @Get(':id/plane-status')
  planeStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.planeStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('gitea-mirror')
  connectGiteaMirror(
    @Body() dto: CreateGiteaMirrorAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createGiteaMirror(dto, req.user.id);
  }

  /** O estado do Gitea Mirror agora (saúde, repositórios por estado, falhas, MCP, versão). */
  @UseGuards(JwtAuthGuard)
  @Get(':id/gitea-mirror-status')
  giteaMirrorStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.giteaMirrorStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('jellyfin')
  connectJellyfin(
    @Body() dto: CreateJellyfinAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createJellyfin(dto, req.user.id);
  }

  /** O estado do Jellyfin agora. */
  @UseGuards(JwtAuthGuard)
  @Get(':id/jellyfin-status')
  jellyfinStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.jellyfinStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('dispatcharr')
  connectDispatcharr(
    @Body() dto: CreateDispatcharrAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createDispatcharr(dto, req.user.id);
  }

  /** O estado do Dispatcharr agora. */
  @UseGuards(JwtAuthGuard)
  @Get(':id/dispatcharr-status')
  dispatcharrStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.dispatcharrStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('coolify')
  connectCoolify(
    @Body() dto: CreateCoolifyAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createCoolify(dto, req.user.id);
  }

  /** O estado do Coolify agora. */
  @UseGuards(JwtAuthGuard)
  @Get(':id/coolify-status')
  coolifyStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.coolifyStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('nginx-proxy-manager')
  connectNginxProxyManager(
    @Body() dto: CreateNginxProxyManagerAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createNginxProxyManager(
      dto,
      req.user.id,
    );
  }

  /** O estado do Nginx Proxy Manager agora. */
  @UseGuards(JwtAuthGuard)
  @Get(':id/nginx-proxy-manager-status')
  nginxProxyManagerStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.nginxProxyManagerStatus(
      id,
      req.user.id,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('tplink-router')
  connectTplinkRouter(
    @Body() dto: CreateTplinkRouterAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createTplinkRouter(dto, req.user.id);
  }

  /** O router agora; desligado volta o estado da ligação (não é um erro). `?force=1` tenta já. */
  @UseGuards(JwtAuthGuard)
  @Get(':id/tplink-router-status')
  tplinkRouterStatus(
    @Param('id') id: string,
    @Query('force') force: string | undefined,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.tplinkRouterStatus(
      id,
      req.user.id,
      force === '1' || force === 'true',
    );
  }

  /** Uma ação no router (Wi-Fi, bloquear, reservas, portas, reiniciar). */
  @UseGuards(JwtAuthGuard)
  @Post(':id/tplink-router-action')
  tplinkRouterAction(
    @Param('id') id: string,
    @Body() dto: TplinkRouterActionDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.tplinkRouterAction(
      id,
      req.user.id,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('clickhouse')
  connectClickHouse(
    @Body() dto: CreateClickHouseAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createClickHouse(dto, req.user.id);
  }

  /** O estado do ClickHouse agora. */
  @UseGuards(JwtAuthGuard)
  @Get(':id/clickhouse-status')
  clickhouseStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.clickhouseStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('postgres')
  connectPostgres(
    @Body() dto: CreatePostgresAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createPostgres(dto, req.user.id);
  }

  /** O estado do PostgreSQL agora. */
  @UseGuards(JwtAuthGuard)
  @Get(':id/postgres-status')
  postgresStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.postgresStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('vaultwarden')
  connectVaultwarden(
    @Body() dto: CreateVaultwardenAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createVaultwarden(dto, req.user.id);
  }

  /** O estado do Vaultwarden agora. */
  @UseGuards(JwtAuthGuard)
  @Get(':id/vaultwarden-status')
  vaultwardenStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.vaultwardenStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('infisical')
  connectInfisical(
    @Body() dto: CreateInfisicalAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createInfisical(dto, req.user.id);
  }

  /** O estado do Infisical agora. */
  @UseGuards(JwtAuthGuard)
  @Get(':id/infisical-status')
  infisicalStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.infisicalStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('opengym')
  connectOpenGym(
    @Body() dto: CreateOpenGymAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createOpenGym(dto, req.user.id);
  }

  /** O estado do openGym agora (servidor, perfil, rotinas, treinos, validade do token). */
  @UseGuards(JwtAuthGuard)
  @Get(':id/opengym-status')
  openGymStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.openGymStatus(id, req.user.id);
  }

  /** O token de API do MCP do openGym: { token } (vazio tira-o). */
  @UseGuards(JwtAuthGuard)
  @Put(':id/opengym-mcp')
  setOpenGymMcp(
    @Param('id') id: string,
    @Body() dto: SetOpenGymMcpDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.setOpenGymMcp(id, req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('trek')
  connectTrek(
    @Body() dto: CreateTrekAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createTrek(dto, req.user.id);
  }

  /** O estado do TREK agora (versão, registo aberto, backups que lá tem). */
  @UseGuards(JwtAuthGuard)
  @Get(':id/trek-status')
  trekStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.trekStatus(id, req.user.id);
  }

  /** O cliente máquina do MCP do TREK: { clientId, clientSecret } (vazios tiram-no). */
  @UseGuards(JwtAuthGuard)
  @Put(':id/trek-mcp')
  setTrekMcp(
    @Param('id') id: string,
    @Body() dto: SetTrekMcpDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.setTrekMcp(id, req.user.id, dto);
  }

  /** As ferramentas do MCP do TREK (Ligações). */
  @UseGuards(JwtAuthGuard)
  @Get(':id/trek-tools')
  trekTools(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.trekTools(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('home-assistant')
  connectHomeAssistant(
    @Body() dto: CreateHomeAssistantAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createHomeAssistant(dto, req.user.id);
  }

  /** O estado do Home Assistant agora (versão, entidades, automações, scripts). */
  @UseGuards(JwtAuthGuard)
  @Get(':id/home-assistant-status')
  homeAssistantStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.homeAssistantStatus(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('adguard')
  connectAdguard(
    @Body() dto: CreateAdguardAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.createAdguard(dto, req.user.id);
  }

  /** O estado do AdGuard agora (proteção, pedidos e bloqueados, listas, regras). */
  @UseGuards(JwtAuthGuard)
  @Get(':id/adguard-status')
  adguardStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.adguardStatus(id, req.user.id);
  }

  /** As definições manuais do AdGuard: de quantas em quantas horas se descarregam as listas. */
  @UseGuards(JwtAuthGuard)
  @Put(':id/adguard-settings')
  setAdguardSettings(
    @Param('id') id: string,
    @Body() dto: SetAdguardSettingsDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.setAdguardSettings(
      id,
      req.user.id,
      dto,
    );
  }

  /** Descarrega já as listas de bloqueio do AdGuard. */
  @UseGuards(JwtAuthGuard)
  @Post(':id/adguard-refresh-filters')
  refreshAdguardFilters(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.refreshAdguardFilters(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/gmail-stats')
  gmailStats(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.getGmailStats(id, req.user.id);
  }

  /** As versões novas desta app (Apps ligadas → Atualizações). */
  @UseGuards(JwtAuthGuard)
  @Get(':id/updates')
  updates(@Param('id') id: string, @Req() req: Request & { user: JwtPayload }) {
    return this.connectedAccountService.listUpdates(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateConnectedAccountDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.connectedAccountService.update(id, req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Req() req: Request & { user: JwtPayload }) {
    return this.connectedAccountService.remove(id, req.user.id);
  }
}
