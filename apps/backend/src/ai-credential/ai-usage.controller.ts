import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { IsNumber, IsOptional, Matches, ValidateIf } from 'class-validator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { AiUsageService } from './ai-usage.service';

type AuthedRequest = Request & { user: JwtPayload };

class UsageQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;
}

class SaveBudgetDto {
  /** Em euros por mês; null tira o limite. */
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  monthlyBudget!: number | null;
}

/** O consumo da IA de quem tem a sessão aberta (Assistente → Definições → IA). */
@Controller('ai/usage')
@UseGuards(JwtAuthGuard)
export class AiUsageController {
  constructor(private readonly usage: AiUsageService) {}

  @Get()
  summary(@Query() query: UsageQueryDto, @Req() req: AuthedRequest) {
    return this.usage.summary(req.user.id, query.month);
  }

  @Put('budget')
  budget(@Body() dto: SaveBudgetDto, @Req() req: AuthedRequest) {
    return this.usage.setBudget(req.user.id, dto.monthlyBudget);
  }
}
