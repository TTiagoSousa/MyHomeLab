import {
  Body,
  Controller,
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
import { UpdateEmailRuleDto } from 'src/email-rule/dto/update-email-rule.dto';
import { EmailRuleProposalService } from './email-rule-proposal.service';

type AuthedRequest = Request & { user: JwtPayload };

/** As regras propostas de uma conta Gmail. As rotas fixas vêm antes de :id. */
@Controller('connected-account/:accountId/email-rule-proposal')
@UseGuards(JwtAuthGuard)
export class EmailRuleProposalController {
  constructor(private readonly service: EmailRuleProposalService) {}

  @Get()
  list(@Param('accountId') accountId: string, @Req() req: AuthedRequest) {
    return this.service.list(req.user.id, accountId);
  }

  @Post('analyze')
  @HttpCode(200)
  analyze(@Param('accountId') accountId: string, @Req() req: AuthedRequest) {
    return this.service.analyzeNow(req.user.id, accountId);
  }

  @Post('implement-all')
  @HttpCode(200)
  implementAll(
    @Param('accountId') accountId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.service.implementAll(req.user.id, accountId);
  }

  @Patch(':id')
  update(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmailRuleDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.update(req.user.id, accountId, id, dto);
  }

  @Post(':id/implement')
  @HttpCode(200)
  implement(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.service.implement(req.user.id, accountId, id);
  }

  /** Uma proposta recusada volta às pendentes. */
  @Post(':id/restore')
  restore(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.service.restore(req.user.id, accountId, id);
  }

  @Post(':id/dismiss')
  @HttpCode(204)
  async dismiss(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ) {
    await this.service.dismiss(req.user.id, accountId, id);
  }
}
