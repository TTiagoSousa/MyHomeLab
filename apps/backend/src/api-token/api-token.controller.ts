import {
  Body,
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
import { ApiTokenService } from './api-token.service';
import { CreateApiTokenDto } from './dto/create-api-token.dto';

type AuthedRequest = Request & { user: JwtPayload };

/** Definições → Acesso pela API. Só com a sessão do site: um token não cria tokens. */
@Controller('api-tokens')
@UseGuards(JwtAuthGuard)
export class ApiTokenController {
  constructor(private readonly tokens: ApiTokenService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.tokens.list(req.user.id);
  }

  @Post()
  create(@Body() dto: CreateApiTokenDto, @Req() req: AuthedRequest) {
    return this.tokens.create(req.user.id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  revoke(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.tokens.revoke(req.user.id, id);
  }
}
