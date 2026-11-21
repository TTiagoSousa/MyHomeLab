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
 * 5 falhas em 15 minutos do mesmo endereço para o mesmo utilizador, ou 30 em 5 minutos
 * para o utilizador vindo de qualquer lado, bloqueiam até passar (ver loginThrottle).
 * O req.ip só é o do cliente com o TRUSTED_PROXIES certo (main.ts): atrás de um proxy
 * que não se confia, todos os pedidos parecem vir dele.
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const body = (req.body ?? {}) as { username?: unknown };
    const user = typeof body.username === 'string' ? body.username : '';
    const ip = req.ip ?? '';
    const wait = loginWaitMinutes(ip, user);
    if (wait) {
      throw new HttpException(
        `Demasiadas tentativas falhadas. Tenta daqui a ${wait} min.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    try {
      const ok = (await super.canActivate(context)) as boolean;
      if (ok) clearLoginFailures(ip, user);
      return ok;
    } catch (error) {
      if (error instanceof UnauthorizedException) recordLoginFailure(ip, user);
      throw error;
    }
  }
}
