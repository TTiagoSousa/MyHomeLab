import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload } from '../jwt-payload.interface';
import { SESSION_COOKIE } from '../session-cookie';
import { Role } from 'src/generated/prisma/client/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.[SESSION_COOKIE] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: {
    sub: string;
    username: string;
    role: Role;
  }): Promise<JwtPayload> {
    return { id: payload.sub, username: payload.username, role: payload.role };
  }
}
