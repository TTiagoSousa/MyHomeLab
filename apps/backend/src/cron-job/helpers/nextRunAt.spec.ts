import { cronTime, nextRunAt } from './nextRunAt';

describe('nextRunAt (cron jobs)', () => {
  it('sem hora, conta o intervalo a partir de agora', () => {
    const from = new Date('2026-11-27T10:00:00Z');
    expect(nextRunAt(60, from)?.toISOString()).toBe('2026-11-27T11:00:00.000Z');
    expect(nextRunAt(0, from)).toBeNull();
  });

  it('todos os dias com hora: a próxima vez a essa hora de Lisboa', () => {
    const before = new Date('2026-11-27T03:00:00Z');
    const after = new Date('2026-11-27T06:00:00Z');
    expect(nextRunAt(1440, before, '05:00')?.toISOString()).toBe(
      '2026-11-27T05:00:00.000Z',
    );
    expect(nextRunAt(1440, after, '05:00')?.toISOString()).toBe(
      '2026-11-28T05:00:00.000Z',
    );
    expect(
      nextRunAt(1440, new Date('2026-07-01T00:00:00Z'), '05:00')?.toISOString(),
    ).toBe('2026-07-01T04:00:00.000Z');
  });

  it('a hora só vale todos os dias', () => {
    expect(cronTime(60, '05:00')).toBeNull();
    expect(cronTime(1440, '5h')).toBeNull();
    expect(cronTime(1440, '05:00')).toBe('05:00');
  });
});
