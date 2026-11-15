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
import { EmailRuleService } from './email-rule.service';
import { CreateEmailRuleDto } from './dto/create-email-rule.dto';
import { UpdateEmailRuleDto } from './dto/update-email-rule.dto';
import { ReorderEmailRuleDto } from './dto/reorder-email-rule.dto';
import { RunEmailRuleDto } from './dto/run-email-rule.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';

@Controller('connected-account/:accountId/email-rule')
@UseGuards(JwtAuthGuard)
export class EmailRuleController {
  constructor(private readonly emailRuleService: EmailRuleService) {}

  @Post()
  create(
    @Param('accountId') accountId: string,
    @Body() dto: CreateEmailRuleDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.emailRuleService.create(accountId, dto, req.user.id);
  }

  @Get()
  findAll(
    @Param('accountId') accountId: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.emailRuleService.findAll(accountId, req.user.id);
  }

  @Post('run')
  run(
    @Param('accountId') accountId: string,
    @Body() dto: RunEmailRuleDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.emailRuleService.run(accountId, dto, req.user.id);
  }

  @Patch('reorder')
  reorder(
    @Param('accountId') accountId: string,
    @Body() dto: ReorderEmailRuleDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.emailRuleService.reorder(accountId, dto, req.user.id);
  }

  @Get(':id')
  findOne(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.emailRuleService.findOne(accountId, id, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmailRuleDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.emailRuleService.update(accountId, id, dto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Param('accountId') accountId: string,
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.emailRuleService.remove(accountId, id, req.user.id);
  }
}
