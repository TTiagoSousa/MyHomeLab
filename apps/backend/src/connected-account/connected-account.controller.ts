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
import { CreateTrekAccountDto } from './dto/create-trek-account.dto';
import { SetTrekMcpDto } from './dto/set-trek-mcp.dto';
import { SetOpenGymMcpDto } from './dto/set-opengym-mcp.dto';
import { CreateHomeAssistantAccountDto } from './dto/create-home-assistant-account.dto';
import { CreateAdguardAccountDto } from './dto/create-adguard-account.dto';
import { SetAdguardSettingsDto } from './dto/set-adguard-settings.dto';

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
      kind === 'tasks' ? 'tasks' : 'gmail',
    );
    res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const kind = await this.connectedAccountService.handleGoogleCallback(
      code,
      state,
    );
    // Volta à página de onde se ligou: a do Gmail ou a do Google Tasks.
    const page = kind === 'tasks' ? 'GoogleTasks' : 'Gmail';
    res.redirect(`${process.env.FRONTEND_URL}/MyHomeLab/Apps/${page}`);
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
