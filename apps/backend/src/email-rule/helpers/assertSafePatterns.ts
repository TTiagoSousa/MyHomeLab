import { BadRequestException } from '@nestjs/common';
import type { MatchType } from 'src/generated/prisma/client/client';

// Limites contra regex que encravam o processo (ReDoS): padrões curtos, sem
// quantificadores dentro de grupos que também se repetem — (a+)+, (a|aa)* — e
// o texto testado cortado. Um cabeçalho From/Subject nunca precisa de mais.
const MAX_PATTERN_LENGTH = 200;
export const MAX_INPUT_LENGTH = 1000;
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[+*}](?:[^()\\]|\\.)*\)\s*[+*{]/;
const REPEATED_ALTERNATION = /\((?:[^()\\]|\\.)*\|(?:[^()\\]|\\.)*\)\s*[+*{]/;

export function isSafePattern(pattern: string): boolean {
  return (
    pattern.length <= MAX_PATTERN_LENGTH &&
    !NESTED_QUANTIFIER.test(pattern) &&
    !REPEATED_ALTERNATION.test(pattern)
  );
}

interface Patterns {
  matchType?: MatchType | null;
  fromContains?: string[] | null;
  subjectContains?: string[] | null;
}

/**
 * Numa regra REGEX, cada padrão tem de compilar e não pode ser dos que encravam o
 * processo. Antes, um padrão destes era aceite e a regra nunca apanhava nada, sem aviso.
 */
export function assertSafePatterns(rule: Patterns): void {
  if (rule.matchType !== 'REGEX') return;
  const patterns = [
    ...(rule.fromContains ?? []),
    ...(rule.subjectContains ?? []),
  ];
  for (const pattern of patterns) {
    try {
      new RegExp(pattern);
    } catch {
      throw new BadRequestException(`Regex inválida: ${pattern}`);
    }
    if (!isSafePattern(pattern)) {
      throw new BadRequestException(
        `Regex recusada (${pattern}): no máximo 200 caracteres e sem repetições dentro de grupos que também se repetem, como (a+)+ ou (a|b)*.`,
      );
    }
  }
}
