import {
  BadGatewayException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';

/**
 * Erro de uma integração direta (uma app ligada, o Nextcloud dos backups), já explicado em
 * português e com o código que o frontend traduz.
 */
export class AppIntegrationError extends Error {
  constructor(
    readonly code: 'APP_AUTH_FAILED' | 'APP_UNREACHABLE' | 'APP_NOT_SUPPORTED',
    message: string,
  ) {
    super(message);
  }
}

/** Credenciais erradas ou função que a app não tem → 400; serviço inacessível → 502; o resto passa como está. */
export function toHttpError(error: unknown): unknown {
  if (error instanceof HttpException) return error;
  if (error instanceof AppIntegrationError) {
    return error.code !== 'APP_UNREACHABLE'
      ? new BadRequestException({ code: error.code, message: error.message })
      : new BadGatewayException({ code: error.code, message: error.message });
  }
  return error;
}
