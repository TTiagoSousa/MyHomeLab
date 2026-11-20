import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { Role } from 'src/generated/prisma/client/client';
import { BackupService } from './backup.service';
import {
  CreateBackupDestinationDto,
  CreateBackupJobDto,
  UpdateBackupDestinationDto,
  UpdateBackupJobDto,
} from './dto/backup.dto';

type AuthedRequest = Request & { user: JwtPayload };

/** Os destinos e os backups automáticos de quem tem a sessão aberta. */
@Controller('backups')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backups: BackupService) {}

  @Get('destinations')
  destinations(@Req() req: AuthedRequest) {
    return this.backups.destinations(req.user.id);
  }

  @Post('destinations')
  createDestination(
    @Body() dto: CreateBackupDestinationDto,
    @Req() req: AuthedRequest,
  ) {
    return this.backups.createDestination(req.user.id, dto);
  }

  @Patch('destinations/:id')
  updateDestination(
    @Param('id') id: string,
    @Body() dto: UpdateBackupDestinationDto,
    @Req() req: AuthedRequest,
  ) {
    return this.backups.updateDestination(req.user.id, id, dto);
  }

  @Delete('destinations/:id')
  @HttpCode(204)
  async removeDestination(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.backups.removeDestination(req.user.id, id);
  }

  @Get('destinations/:id/check')
  checkDestination(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.backups.checkDestination(req.user.id, id);
  }

  /** Os backups do próprio MyHomeLab (o `?instance=1` antigo já não muda nada). */
  @Get('jobs')
  jobs(@Req() req: AuthedRequest) {
    return this.backups.jobs(req.user.id);
  }

  @Post('jobs')
  createJob(@Body() dto: CreateBackupJobDto, @Req() req: AuthedRequest) {
    return this.backups.createJob(
      req.user.id,
      dto,
      req.user.role === Role.ADMIN,
    );
  }

  @Patch('jobs/:id')
  updateJob(
    @Param('id') id: string,
    @Body() dto: UpdateBackupJobDto,
    @Req() req: AuthedRequest,
  ) {
    return this.backups.updateJob(req.user.id, id, dto);
  }

  @Delete('jobs/:id')
  @HttpCode(204)
  async removeJob(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.backups.removeJob(req.user.id, id);
  }

  @Post('jobs/:id/run')
  @HttpCode(200)
  run(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.backups.runNow(req.user.id, id);
  }
}
