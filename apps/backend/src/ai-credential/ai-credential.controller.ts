import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { AiCredentialService } from './ai-credential.service';
import { SaveAiCredentialDto } from './dto/save-ai-credential.dto';
import { SaveAiModelsDto } from './dto/save-ai-models.dto';

type AuthedRequest = Request & { user: JwtPayload };

/** A IA de quem tem a sessão aberta: o Claude Code desta máquina, com a subscrição. */
@Controller('ai/providers')
@UseGuards(JwtAuthGuard)
export class AiCredentialController {
  constructor(private readonly service: AiCredentialService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.service.list(req.user.id);
  }

  /** Se o Claude Code está instalado e com sessão. */
  @Get('claude-code/status')
  status(@Req() req: AuthedRequest) {
    return this.service.status(req.user.id);
  }

  /** Guarda o token da subscrição (claude setup-token), depois de o testar. */
  @Put('claude-code')
  save(@Body() dto: SaveAiCredentialDto, @Req() req: AuthedRequest) {
    return this.service.save(req.user.id, dto.apiKey);
  }

  @Get('claude-code/models')
  models() {
    return this.service.models();
  }

  @Put('claude-code/models')
  setModels(@Body() dto: SaveAiModelsDto, @Req() req: AuthedRequest) {
    return this.service.setModels(req.user.id, dto);
  }

  /** Tira o token: volta ao login desta máquina. */
  @Delete('claude-code')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest) {
    await this.service.remove(req.user.id);
  }
}
