import {
  lisbonInstant,
  lisbonStamp,
  lisbonToday,
  parseLisbonDate,
} from './lisbonTime';

describe('as datas das apps à hora de Portugal', () => {
  it('em agosto mostra uma hora a mais que o UTC', () => {
    expect(lisbonStamp('2026-08-01T20:00:00Z')).toBe('2026-08-01 21:00');
    expect(lisbonStamp('2026-08-01T20:00:00')).toBe('2026-08-01 21:00');
    expect(lisbonStamp(Date.UTC(2026, 7, 1, 20) / 1000)).toBe(
      '2026-08-01 21:00',
    );
  });

  it('em dezembro mostra a mesma hora que o UTC', () => {
    expect(lisbonStamp(new Date('2026-12-01T20:00:00.0000000Z'))).toBe(
      '2026-12-01 20:00',
    );
  });

  it('sem data mostra o texto de vazio', () => {
    expect(lisbonStamp(null, 'nunca')).toBe('nunca');
  });

  it('uma hora sem fuso pedida pelo agente é de Lisboa', () => {
    expect(parseLisbonDate('2026-08-01 21:00')?.toISOString()).toBe(
      '2026-08-01T20:00:00.000Z',
    );
    expect(parseLisbonDate('2026-12-01T21:00:00')?.toISOString()).toBe(
      '2026-12-01T21:00:00.000Z',
    );
    expect(parseLisbonDate('2026-08-01T21:00:00+02:00')?.toISOString()).toBe(
      '2026-08-01T19:00:00.000Z',
    );
    expect(parseLisbonDate('amanhã')).toBeNull();
  });
});

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
