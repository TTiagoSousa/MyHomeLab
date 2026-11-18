import {
  Body,
  Controller,
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
import { CronJobService } from './cron-job.service';
import { SaveCronJobDto } from './dto/save-cron-job.dto';

type AuthedRequest = Request & { user: JwtPayload };

/** Os cron jobs de uma app ligada: as tarefas fixas que o MyHomeLab corre sozinho. */
@Controller('connected-account/:accountId/cron-jobs')
@UseGuards(JwtAuthGuard)
export class CronJobController {
  constructor(private readonly service: CronJobService) {}

  @Get()
  list(@Param('accountId') accountId: string, @Req() req: AuthedRequest) {
    return this.service.list(req.user.id, accountId);
  }

  @Put(':key')
  save(
    @Param('accountId') accountId: string,
    @Param('key') key: string,
    @Body() dto: SaveCronJobDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.save(req.user.id, accountId, key, dto.intervalMinutes);
  }

  @Post(':key/run')
  run(
    @Param('accountId') accountId: string,
    @Param('key') key: string,
    @Req() req: AuthedRequest,
  ) {
    return this.service.runNow(req.user.id, accountId, key);
  }
}
