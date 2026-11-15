import {
  HttpException,
  HttpStatus,
  PreconditionFailedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ClaudeCodeError } from 'src/claude-code/claudeCode.runner';

/**
 * Erros com código, para o frontend os traduzir. A mensagem em português fica
 * para quem lê os logs ou chama a API à mão.
 */
export const AI_ERRORS = {
  KEY_MISSING: 'AI_KEY_MISSING',
  KEY_INVALID: 'AI_KEY_INVALID',
  KEY_UNVERIFIED: 'AI_KEY_UNVERIFIED',
  NO_CREDIT: 'AI_NO_CREDIT',
  RATE_LIMITED: 'AI_RATE_LIMITED',
  UNAVAILABLE: 'AI_UNAVAILABLE',
  PROVIDER_UNKNOWN: 'AI_PROVIDER_UNKNOWN',
  REQUEST_REFUSED: 'AI_REQUEST_REFUSED',
} as const;

/**
 * Traduz as falhas do Claude Code que são da conta do utilizador (sem sessão,
 * limite da subscrição, não instalado) num erro com código. Sem isto chegavam
 * ao browser como um 500 genérico. Devolve null para o resto.
 */
export function aiFailure(error: unknown): HttpException | null {
  if (!(error instanceof ClaudeCodeError)) return null;
  if (error.code === 'NOT_LOGGED_IN') {
    return new PreconditionFailedException({
      code: AI_ERRORS.KEY_INVALID,
      message:
        'O Claude Code não tem sessão iniciada. Vê Definições → IA (claude auth login ou o token).',
    });
  }
  if (error.code === 'LIMIT') {
    return new HttpException(
      {
        code: AI_ERRORS.RATE_LIMITED,
        message:
          'A subscrição do Claude chegou ao limite. Volta a funcionar quando o limite renovar.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  if (error.code === 'NOT_INSTALLED' || error.code === 'TIMEOUT') {
    return new ServiceUnavailableException({
      code: AI_ERRORS.UNAVAILABLE,
      message: error.message,
    });
  }
  return null;
}
