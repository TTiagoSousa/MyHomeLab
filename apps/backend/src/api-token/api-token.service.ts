import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { apiTokenRefusal } from './helpers/apiTokenAccess';
import { hashApiToken, newApiToken } from './helpers/apiTokenSecret';

/** O "usado há pouco" só se grava de minuto a minuto: não é uma escrita por pedido. */
const TOUCH_EVERY_MS = 60_000;

const VIEW = {
  id: true,
  name: true,
  scope: true,
  prefix: true,
  lastUsedAt: true,
  expiresAt: true,
  createdAt: true,
} as const;

/**
 * Tokens pessoais: para usar a API sem o browser (ex.: o Claude Code a ver a produção).
 * Cada um vale pelo utilizador que o criou, com o âmbito escolhido.
 */
@Injectable()
export class ApiTokenService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.apiToken.findMany({
      where: { userId },
      select: VIEW,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** O token só se devolve aqui, uma vez; depois fica só o hash. */
  async create(userId: string, dto: CreateApiTokenDto) {
    const { token, tokenHash, prefix } = newApiToken();
    const saved = await this.prisma.apiToken.create({
      data: {
        userId,
        name: dto.name.trim(),
        scope: dto.scope,
        tokenHash,
        prefix,
        expiresAt: dto.expiresInDays
          ? new Date(Date.now() + dto.expiresInDays * 86_400_000)
          : null,
      },
      select: VIEW,
    });
    return { ...saved, token };
  }

  async revoke(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.apiToken.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException('Este token já não existe.');
  }

  /** Quem é este token, se pode fazer este pedido. */
  async authenticate(
    token: string,
    method: string,
    path: string,
  ): Promise<JwtPayload> {
    const found = await this.prisma.apiToken.findUnique({
      where: { tokenHash: hashApiToken(token) },
      include: { user: { select: { id: true, username: true, role: true } } },
    });
    if (!found || (found.expiresAt && found.expiresAt < new Date())) {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
    const refusal = apiTokenRefusal(found.scope, method, path);
    if (refusal) throw new UnauthorizedException(refusal);
    if (
      !found.lastUsedAt ||
      Date.now() - found.lastUsedAt.getTime() > TOUCH_EVERY_MS
    ) {
      await this.prisma.apiToken
        .update({ where: { id: found.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
    }
    return found.user;
  }
}
