import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload } from '../jwt-payload.interface';
import { SESSION_COOKIE } from '../session-cookie';
import { SESSION_AUDIENCE } from '../token-audience';
import { PrismaUserRepository } from 'src/user/repositories/prisma/prisma-user-repository';
import {
  SessionTokenPayload,
  validateSession,
} from '../helpers/validateSession';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly userRepository: PrismaUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) =>
          (req?.cookies as Record<string, string> | undefined)?.[
            SESSION_COOKIE
          ] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
      // Só tokens de sessão: o state do OAuth do Google é assinado com o mesmo segredo.
      audience: SESSION_AUDIENCE,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: SessionTokenPayload): Promise<JwtPayload> {
    return validateSession(payload, this.userRepository);
  }
}
