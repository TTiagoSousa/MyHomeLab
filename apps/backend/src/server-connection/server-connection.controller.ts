import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { ServerConnectionService } from './server-connection.service';
import { ServerCommandService } from './server-command.service';
import { ServerSshDto } from './dto/server-ssh.dto';
import {
  CreateServerConnectionDto,
  UpdateServerConnectionDto,
} from './dto/save-server-connection.dto';

type AuthedRequest = Request & { user: JwtPayload };

/** Os servidores de quem tem a sessão aberta — cada um só vê os seus. */
@Controller('servers')
@UseGuards(JwtAuthGuard)
export class ServerConnectionController {
  constructor(
    private readonly service: ServerConnectionService,
    private readonly commands: ServerCommandService,
  ) {}

  /** O registo de comandos deste servidor. */
  @Get(':id/commands')
  listCommands(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.commands.list(req.user.id, id);
  }

  /** Liga os comandos: gera (ou troca) o par de chaves SSH. */
  @Post(':id/ssh')
  async enableSsh(
    @Param('id') id: string,
    @Body() dto: ServerSshDto,
    @Req() req: AuthedRequest,
  ) {
    await this.commands.enableSsh(req.user.id, id, dto);
    return this.service.view(req.user.id, id);
  }

  @Patch(':id/ssh')
  async updateSsh(
    @Param('id') id: string,
    @Body() dto: ServerSshDto,
    @Req() req: AuthedRequest,
  ) {
    await this.commands.updateSsh(req.user.id, id, dto);
    return this.service.view(req.user.id, id);
  }

  @Delete(':id/ssh')
  @HttpCode(204)
  async disableSsh(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.commands.disableSsh(req.user.id, id);
  }

  /** Confia na chave nova do servidor (depois de o reinstalar): a próxima ligação guarda-a. */
  @Post(':id/ssh/host-key/reset')
  async resetSshHostKey(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.commands.resetSshHostKey(req.user.id, id);
    return this.service.view(req.user.id, id);
  }

  @Get(':id/ssh/test')
  testSsh(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.commands.testSsh(req.user.id, id);
  }

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.service.list(req.user.id);
  }

  @Post()
  create(@Body() dto: CreateServerConnectionDto, @Req() req: AuthedRequest) {
    return this.service.create(req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServerConnectionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @Query('force') force: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    await this.service.remove(req.user.id, id, force === 'true');
  }

  @Get(':id/guests')
  guests(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.service.guests(req.user.id, id);
  }

  /** As atualizações à espera nos nós e se há versão nova do Proxmox VE. */
  @Get(':id/updates')
  updates(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.service.updates(req.user.id, id);
  }

  @Get(':id/check')
  check(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.service.check(req.user.id, id);
  }

  /** `?timeframe=hour|day|week|month` — o intervalo do histórico (omissão: hour). */
  @Get(':id/dashboard')
  dashboard(
    @Param('id') id: string,
    @Query('timeframe') timeframe: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    return this.service.dashboard(req.user.id, id, timeframe);
  }
}
