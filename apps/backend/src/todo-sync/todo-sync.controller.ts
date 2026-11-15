import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { SaveTodoSyncGroupDto, TodoSyncSettingDto } from './dto/todo-sync.dto';
import { TodoSyncService } from './todo-sync.service';

type AuthedRequest = Request & { user: JwtPayload };

/** A sincronização das Tarefas (Tarefas → Sincronização). */
@Controller('todo-sync')
@UseGuards(JwtAuthGuard)
export class TodoSyncController {
  constructor(private readonly sync: TodoSyncService) {}

  /** O interruptor, o intervalo, as listas daqui, os emails e os grupos. */
  @Get()
  overview(@Req() req: AuthedRequest) {
    return this.sync.overview(req.user.id);
  }

  @Put('setting')
  setting(@Body() dto: TodoSyncSettingDto, @Req() req: AuthedRequest) {
    return this.sync.saveSetting(req.user.id, dto);
  }

  @Get('accounts/:id/lists')
  remoteLists(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.sync.remoteLists(req.user.id, id);
  }

  @Post('groups')
  createGroup(@Body() dto: SaveTodoSyncGroupDto, @Req() req: AuthedRequest) {
    return this.sync.saveGroup(req.user.id, dto);
  }

  @Put('groups/:id')
  updateGroup(
    @Param('id') id: string,
    @Body() dto: SaveTodoSyncGroupDto,
    @Req() req: AuthedRequest,
  ) {
    return this.sync.saveGroup(req.user.id, dto, id);
  }

  /** Desfaz o grupo; as tarefas ficam em todo o lado. */
  @Delete('groups/:id')
  removeGroup(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.sync.removeGroup(req.user.id, id);
  }

  /** Sincroniza já (espera que acabe e devolve o estado novo). */
  @Post('run')
  run(@Req() req: AuthedRequest) {
    return this.sync.runNow(req.user.id);
  }
}
