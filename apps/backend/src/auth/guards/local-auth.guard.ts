import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import {
  clearLoginFailures,
  loginWaitMinutes,
  recordLoginFailure,
} from '../helpers/loginThrottle';

/**
 * O login com utilizador e password, com travão contra quem tenta adivinhar:
 * 5 falhas em 15 minutos (pelo endereço e pelo utilizador) bloqueiam até passar.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const body = (req.body ?? {}) as { username?: unknown };
    const user = typeof body.username === 'string' ? body.username : '';
    const key = `${req.ip ?? '?'}|${user.trim().toLowerCase()}`;
    const wait = loginWaitMinutes(key);
    if (wait) {
      throw new HttpException(
        `Demasiadas tentativas falhadas. Tenta daqui a ${wait} min.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    try {
      const ok = (await super.canActivate(context)) as boolean;
      if (ok) clearLoginFailures(key);
      return ok;
    } catch (error) {
      if (error instanceof UnauthorizedException) recordLoginFailure(key);
      throw error;
    }
  }
}
