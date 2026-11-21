import { UnauthorizedException } from '@nestjs/common';
import { Role } from 'src/generated/prisma/client/client';
import { PrismaUserRepository } from 'src/user/repositories/prisma/prisma-user-repository';
import { JwtPayload } from '../jwt-payload.interface';
import { SESSION_AUDIENCE } from '../token-audience';

export interface SessionTokenPayload {
  sub?: unknown;
  username?: unknown;
  role?: unknown;
  ver?: unknown;
  aud?: unknown;
}

const ROLES = Object.values(Role) as string[];

function hasSessionAudience(aud: unknown) {
  return Array.isArray(aud)
    ? aud.includes(SESSION_AUDIENCE)
    : aud === SESSION_AUDIENCE;
}

/**
 * O que o JwtStrategy faz a cada pedido: o token tem de ser de sessão (audience, `sub`,
 * `role` e `ver`) e o utilizador tem de existir com o mesmo tokenVersion. O id e o role
 * vêm da base de dados e não do token — um utilizador apagado ou despromovido perdia o
 * acesso só quando o token expirasse, ao fim de 7 dias.
 */
export async function validateSession(
  payload: SessionTokenPayload,
  userRepository: PrismaUserRepository,
): Promise<JwtPayload> {
  if (
    !hasSessionAudience(payload.aud) ||
    typeof payload.sub !== 'string' ||
    !payload.sub ||
    typeof payload.role !== 'string' ||
    !ROLES.includes(payload.role) ||
    typeof payload.ver !== 'number'
  ) {
    throw new UnauthorizedException('Sessão inválida. Volta a entrar.');
  }

  const user = await userRepository.findSessionById(payload.sub);
  if (!user || user.tokenVersion !== payload.ver) {
    throw new UnauthorizedException('A sessão terminou. Volta a entrar.');
  }

  return { id: user.id, username: user.username, role: user.role };
}
