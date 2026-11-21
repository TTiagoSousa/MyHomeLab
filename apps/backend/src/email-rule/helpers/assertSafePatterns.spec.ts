import { BadRequestException } from '@nestjs/common';
import { assertSafePatterns, isSafePattern } from './assertSafePatterns';

describe('padrões das regras de email', () => {
  it.each(['@amazon\\.com$', '^(fatura|recibo)', 'newsletter', '[0-9]{4}'])(
    '"%s" é aceite',
    (pattern) => {
      expect(isSafePattern(pattern)).toBe(true);
    },
  );

  it.each(['(a+)+$', '(a*)*b', '(x|xx)+y', 'a'.repeat(201)])(
    '"%s" é recusado',
    (pattern) => {
      expect(isSafePattern(pattern)).toBe(false);
    },
  );

  it('recusa uma regra REGEX com padrão inválido ou perigoso', () => {
    expect(() =>
      assertSafePatterns({ matchType: 'REGEX', fromContains: ['(abc'] }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertSafePatterns({ matchType: 'REGEX', subjectContains: ['(a+)+'] }),
    ).toThrow(BadRequestException);
  });

  it('não olha para regras que não são REGEX', () => {
    expect(() =>
      assertSafePatterns({ matchType: 'CONTAINS', fromContains: ['(a+)+'] }),
    ).not.toThrow();
  });
});
