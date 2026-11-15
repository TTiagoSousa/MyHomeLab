import { ConsoleLogger } from '@nestjs/common';

export interface LoggedProblem {
  at: string;
  level: 'error' | 'warn';
  context: string;
  message: string;
}

const KEPT = 100;
const problems: LoggedProblem[] = [];

const text = (message: unknown) =>
  (message instanceof Error ? message.message : String(message)).slice(0, 1000);

/** Os últimos avisos e erros do backend (para o ecrã de estado), do mais novo para o mais velho. */
export const recentProblems = () => [...problems].reverse();

/**
 * O logger do Nest que, além de escrever na consola, guarda os últimos avisos e
 * erros em memória para o ecrã de estado (Admin → Estado).
 */
export class StatusLogger extends ConsoleLogger {
  error(message: unknown, ...rest: unknown[]) {
    this.keep('error', message, rest);
    super.error(message, ...(rest as []));
  }

  warn(message: unknown, ...rest: unknown[]) {
    this.keep('warn', message, rest);
    super.warn(message, ...(rest as []));
  }

  private keep(level: 'error' | 'warn', message: unknown, rest: unknown[]) {
    const context =
      typeof rest[rest.length - 1] === 'string'
        ? (rest[rest.length - 1] as string)
        : '';
    problems.push({
      at: new Date().toISOString(),
      level,
      context,
      message: text(message),
    });
    if (problems.length > KEPT) problems.shift();
  }
}
