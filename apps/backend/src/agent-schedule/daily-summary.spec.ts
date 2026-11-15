import { lisbonDayStart } from './daily-summary.scheduler';

describe('a meia-noite de Lisboa', () => {
  it('no inverno é a meia-noite UTC', () => {
    expect(lisbonDayStart('2026-11-06').toISOString()).toBe(
      '2026-11-06T00:00:00.000Z',
    );
  });

  it('no verão é uma hora antes, em UTC', () => {
    expect(lisbonDayStart('2026-07-15').toISOString()).toBe(
      '2026-07-14T23:00:00.000Z',
    );
  });
});
