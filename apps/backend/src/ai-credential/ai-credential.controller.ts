import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import {
  AiCredentialService,
  AiProviderId,
  PROVIDER_OF,
} from './ai-credential.service';
import { SaveAiCredentialDto } from './dto/save-ai-credential.dto';
import { SaveAiModelsDto } from './dto/save-ai-models.dto';

type AuthedRequest = Request & { user: JwtPayload };

const providerId = (value: string): AiProviderId => {
  if (value in PROVIDER_OF) return value as AiProviderId;
  throw new BadRequestException('Fornecedor de IA desconhecido');
};

/**
 * A IA de quem tem a sessão aberta: o Claude Code desta máquina (com a subscrição) ou
 * a API da Anthropic (com a chave dele). Só um está em uso.
 */
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

  /** Tira o token: volta ao login desta máquina. */
  @Delete('claude-code')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest) {
    await this.service.remove(req.user.id);
  }

  /** Guarda a chave da API da Anthropic, depois de a testar. */
  @Put('claude-api')
  saveApiKey(@Body() dto: SaveAiCredentialDto, @Req() req: AuthedRequest) {
    return this.service.saveApiKey(req.user.id, dto.apiKey);
  }

  /** Tira a chave da API; se estava em uso, volta ao Claude Code. */
  @Delete('claude-api')
  @HttpCode(204)
  async removeApiKey(@Req() req: AuthedRequest) {
    await this.service.removeApiKey(req.user.id);
  }

  /** Os modelos que se podem escolher (os mesmos nos dois fornecedores). */
  @Get(':provider/models')
  models(@Param('provider') provider: string) {
    providerId(provider);
    return this.service.models();
  }

  @Put(':provider/models')
  setModels(
    @Param('provider') provider: string,
    @Body() dto: SaveAiModelsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.setModels(req.user.id, dto, providerId(provider));
  }

  /** Põe este fornecedor em uso. */
  @Put(':provider/active')
  activate(@Param('provider') provider: string, @Req() req: AuthedRequest) {
    return this.service.activate(req.user.id, providerId(provider));
  }
}
