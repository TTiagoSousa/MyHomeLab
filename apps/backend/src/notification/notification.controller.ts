import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { NotificationService } from './notification.service';

type AuthedRequest = Request & { user: JwtPayload };

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.service.list(req.user.id);
  }

  @Get('count')
  count(@Req() req: AuthedRequest) {
    return this.service.count(req.user.id);
  }

  @Delete('resolved')
  @HttpCode(204)
  async clearResolved(@Req() req: AuthedRequest) {
    await this.service.clearResolved(req.user.id);
  }

  @Post(':id/dismiss')
  @HttpCode(204)
  async dismiss(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.service.dismiss(req.user.id, id);
  }
}
