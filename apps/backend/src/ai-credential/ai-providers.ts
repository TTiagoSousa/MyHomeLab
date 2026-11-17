import {
  HttpException,
  HttpStatus,
  PreconditionFailedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
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

/** As falhas da API da Anthropic que são da conta do utilizador (chave, crédito, limite). */
function apiFailure(error: unknown): HttpException | null {
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return new PreconditionFailedException({
      provider: 'claude-api',
      code: AI_ERRORS.KEY_INVALID,
      message: 'A chave da API da Anthropic não é válida. Vê Definições → IA.',
    });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new HttpException(
      {
        provider: 'claude-api',
        code: AI_ERRORS.RATE_LIMITED,
        message: 'A API da Anthropic pediu para esperar (limite de pedidos).',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  // Sem saldo, a API responde 400 com uma mensagem sobre o crédito: é a única forma de o ver.
  if (
    error instanceof Anthropic.BadRequestError &&
    /credit balance/i.test(error.message)
  ) {
    return new PreconditionFailedException({
      provider: 'claude-api',
      code: AI_ERRORS.NO_CREDIT,
      message: 'A conta da API da Anthropic não tem crédito.',
    });
  }
  if (
    error instanceof Anthropic.InternalServerError ||
    error instanceof Anthropic.APIConnectionError
  ) {
    return new ServiceUnavailableException({
      provider: 'claude-api',
      code: AI_ERRORS.UNAVAILABLE,
      message: 'A API da Anthropic não está a responder.',
    });
  }
  return null;
}

/**
 * Traduz as falhas do Claude Code que são da conta do utilizador (sem sessão,
 * limite da subscrição, não instalado) num erro com código. Sem isto chegavam
 * ao browser como um 500 genérico. Devolve null para o resto.
 */
export function aiFailure(error: unknown): HttpException | null {
  const api = apiFailure(error);
  if (api) return api;
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
