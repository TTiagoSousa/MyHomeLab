import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { DiskHealthService } from './disk-health.service';

type AuthedRequest = Request & { user: JwtPayload };

/** A saúde dos discos de um servidor — lida na hora, e guardada no histórico. */
@Controller('servers')
@UseGuards(JwtAuthGuard)
export class DiskHealthController {
  constructor(private readonly diskHealth: DiskHealthService) {}

  @Get(':id/disks')
  disks(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.diskHealth.overview(req.user.id, id);
  }
}
