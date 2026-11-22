import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { ChatApprovalService } from './chat-approval.service';

type AuthedRequest = Request & { user: JwtPayload };

/** Os cartões do chat: o que os agentes querem fazer e espera pelo sim dele. */
@Controller('chat-approvals')
@UseGuards(JwtAuthGuard)
export class ChatApprovalController {
  constructor(private readonly approvals: ChatApprovalService) {}

  @Get()
  pending(
    @Req() req: AuthedRequest,
    @Query('conversationId') conversationId?: string,
  ) {
    return this.approvals.pending(req.user.id, conversationId || undefined);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.approvals.approve(req.user.id, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.approvals.reject(req.user.id, id);
  }
}
