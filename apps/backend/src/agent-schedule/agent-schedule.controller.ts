import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { AgentScheduleService, ScheduleInput } from './agent-schedule.service';
import { AgentScheduleRunner } from './agent-schedule.runner';
import { DailySummaryScheduler } from './daily-summary.scheduler';
import {
  AgentSummaryQueryDto,
  ListAgentSchedulesQueryDto,
  SaveAgentScheduleDto,
} from './dto/agent-schedule.dto';

type AuthedRequest = Request & { user: JwtPayload };

const toInput = (dto: SaveAgentScheduleDto): ScheduleInput => ({
  ...dto,
  runAt:
    dto.runAt === undefined
      ? undefined
      : dto.runAt
        ? new Date(dto.runAt)
        : null,
});

/** Os agendamentos dos agentes de quem tem a sessão aberta. */
@Controller('schedules')
@UseGuards(JwtAuthGuard)
export class AgentScheduleController {
  constructor(
    private readonly schedules: AgentScheduleService,
    private readonly runner: AgentScheduleRunner,
    private readonly summary: DailySummaryScheduler,
  ) {}

  @Get()
  list(@Query() query: ListAgentSchedulesQueryDto, @Req() req: AuthedRequest) {
    return this.schedules.list(req.user.id, query);
  }

  /** O que os agentes fizeram entre dois dias (o resumo das 21h, para outras datas). */
  @Get('summary')
  between(@Query() query: AgentSummaryQueryDto, @Req() req: AuthedRequest) {
    return this.summary.between(req.user.id, query.from, query.to);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.schedules.get(req.user.id, id);
  }

  @Post()
  create(@Body() dto: SaveAgentScheduleDto, @Req() req: AuthedRequest) {
    return this.schedules.create(req.user.id, toInput(dto));
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: SaveAgentScheduleDto,
    @Req() req: AuthedRequest,
  ) {
    return this.schedules.update(req.user.id, id, toInput(dto));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.schedules.remove(req.user.id, id);
  }

  /** "Correr agora": não mexe na próxima vez marcada. */
  @Post(':id/run')
  @HttpCode(202)
  async run(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.runner.runNow(req.user.id, id);
    return this.schedules.get(req.user.id, id);
  }
}
