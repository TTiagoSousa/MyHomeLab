import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { ApiTokenService } from 'src/api-token/api-token.service';
import { apiTokenFrom } from 'src/api-token/helpers/apiTokenSecret';
import { JwtPayload } from '../jwt-payload.interface';

/**
 * A sessão do site (cookie) ou um token pessoal ("Authorization: Bearer mhl_…"), com o
 * âmbito dele: o de leitura só passa em GET.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly apiTokens: ApiTokenService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const token = apiTokenFrom(req.headers.authorization);
    if (!token) return (await super.canActivate(context)) as boolean;
    req.user = await this.apiTokens.authenticate(token, req.method, req.path);
    return true;
  }
}
