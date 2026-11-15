import { readFileSync } from 'fs';
import { join } from 'path';
import { timingSafeEqual } from 'crypto';

/**
 * O token do terminal (`npm run claude`): um ficheiro ao lado do backend que o
 * script cria na primeira vez (fora do git). Só quem lê ficheiros desta máquina
 * o tem; o backend lê-o a cada pedido.
 */
export const terminalTokenFile = () =>
  process.env.CLAUDE_TERMINAL_TOKEN_FILE ??
  join(process.cwd(), '.claude-terminal-token');

export function isTerminalToken(authorization: string | undefined): boolean {
  let expected = '';
  try {
    expected = readFileSync(terminalTokenFile(), 'utf8').trim();
  } catch {
    return false;
  }
  const given = authorization?.replace(/^Bearer\s+/i, '').trim() ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return (
    expected.length >= 32 && a.length === b.length && timingSafeEqual(a, b)
  );
}
