import { metricAverages } from './metricAverages';
import { checkedValues } from './checkedValues';

const point = (day: string, value: number) => ({
  day,
  at: new Date(`${day}T08:00:00Z`),
  value,
});

describe('metricAverages', () => {
  it('dá o último, a variação, a média e o mínimo/máximo do período', () => {
    const averages = metricAverages([
      point('2026-11-03', 21.4),
      point('2026-11-01', 22),
      point('2026-11-02', 21),
    ]);
    expect(averages).toMatchObject({
      entries: 3,
      from: '2026-11-01',
      to: '2026-11-03',
      latest: 21.4,
      change: -0.6,
      avg: 21.5,
      min: 21,
      minDay: '2026-11-02',
      max: 22,
      maxDay: '2026-11-01',
    });
  });

  it('sem valores fica tudo a null', () => {
    expect(metricAverages([])).toMatchObject({
      entries: 0,
      latest: null,
      change: null,
      avg: null,
    });
  });
});

describe('checkedValues', () => {
  it('arredonda e ignora os campos vazios', () => {
    expect(
      checkedValues(['weightKg', 'bmrKcal', 'bodyFatPct'], {
        weightKg: 72.456,
        bmrKcal: 1650.6,
        bodyFatPct: null,
      }),
    ).toEqual({ weightKg: 72.46, bmrKcal: 1651 });
  });

  it('recusa um valor fora dos limites', () => {
    expect(() => checkedValues(['waterPct'], { waterPct: 120 })).toThrow();
  });
});
