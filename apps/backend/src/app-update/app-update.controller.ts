import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { AppUpdateService } from './app-update.service';
import { UpdateAttemptService } from './update-attempt.service';
import { SaveUpdateSettingDto } from './dto/update-setting.dto';

type AuthedRequest = Request & { user: JwtPayload };

/** Onde ficam as tarefas das atualizações das apps (o quadro e o projeto) e o estudo automático. */
@Controller('app-updates')
@UseGuards(JwtAuthGuard)
export class AppUpdateController {
  constructor(
    private readonly updates: AppUpdateService,
    private readonly attempts: UpdateAttemptService,
  ) {}

  /** As tentativas de atualizar (de uma app, do Proxmox de um servidor, ou todas): Apps ligadas e Documentos. */
  @Get('attempts')
  attemptList(
    @Query('accountId') accountId: string | undefined,
    @Query('serverId') serverId: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    return this.attempts.list(req.user.id, {
      accountId: accountId || undefined,
      serverId: serverId || undefined,
      limit: limit ? Number(limit) || undefined : undefined,
    });
  }

  @Get('attempts/:id')
  attempt(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.attempts.get(req.user.id, id);
  }

  @Get('setting')
  setting(@Req() req: AuthedRequest) {
    return this.updates.getSetting(req.user.id);
  }

  @Put('setting')
  saveSetting(@Body() dto: SaveUpdateSettingDto, @Req() req: AuthedRequest) {
    return this.updates.saveSetting(req.user.id, dto);
  }
}
