import { JwtService } from '@nestjs/jwt';
import { Role } from 'src/generated/prisma/client/client';
import { SESSION_AUDIENCE } from '../token-audience';

/**
 * Assina o cookie de sessão. O `ver` é o tokenVersion do utilizador neste momento: sair
 * (ou mudar a password) sobe-o e as sessões assinadas antes deixam de valer.
 */
export function loginUser(
  user: { id: string; username: string; role: Role; tokenVersion: number },
  jwtService: JwtService,
) {
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    ver: user.tokenVersion,
  };
  return jwtService.sign(payload, { audience: SESSION_AUDIENCE });
}
