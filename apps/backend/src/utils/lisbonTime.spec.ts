import { lisbonInstant, lisbonToday } from './lisbonTime';

describe('as datas em hora de Portugal', () => {
  it('no inverno, Lisboa está em UTC', () => {
    expect(lisbonInstant('2026-01-15', '20:00').toISOString()).toBe(
      '2026-01-15T20:00:00.000Z',
    );
  });

  it('no verão, Lisboa está uma hora à frente', () => {
    expect(lisbonInstant('2026-07-15', '20:00').toISOString()).toBe(
      '2026-07-15T19:00:00.000Z',
    );
  });

  it('o dia de hoje vem em AAAA-MM-DD', () => {
    expect(lisbonToday(new Date('2026-07-15T23:30:00Z'))).toBe('2026-07-16');
  });

  it('recusa datas mal escritas', () => {
    expect(() => lisbonInstant('15/07/2026')).toThrow();
  });
});
