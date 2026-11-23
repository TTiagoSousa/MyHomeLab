import { fetchForecast } from './fetchForecast';

describe('fetchForecast', () => {
  afterEach(() => jest.restoreAllMocks());

  it('arredonda as temperaturas e junta os dias', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          current: { temperature_2m: 17.6, weather_code: 3, is_day: 1 },
          daily: {
            time: ['2026-11-23', '2026-11-24'],
            temperature_2m_max: [20.4, 18.5],
            temperature_2m_min: [11.2, 9.9],
            precipitation_probability_max: [10, null],
            weather_code: [3, 61],
          },
        }),
      ),
    );
    const forecast = await fetchForecast({
      latitude: 38.7,
      longitude: -9.1,
      timezone: 'Europe/Lisbon',
    });
    expect(forecast.current).toEqual({
      temperature: 18,
      weatherCode: 3,
      isDay: true,
    });
    expect(forecast.daily[1]).toEqual({
      date: '2026-11-24',
      max: 19,
      min: 10,
      rainChance: null,
      weatherCode: 61,
    });
  });

  it('falha com o código quando o Open-Meteo responde mal', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('', { status: 503 }));
    await expect(
      fetchForecast({ latitude: 0, longitude: 0, timezone: 'UTC' }),
    ).rejects.toThrow('503');
  });
});
