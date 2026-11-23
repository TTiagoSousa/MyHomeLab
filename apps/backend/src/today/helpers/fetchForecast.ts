export interface Forecast {
  current: { temperature: number; weatherCode: number; isDay: boolean };
  daily: {
    date: string;
    max: number;
    min: number;
    rainChance: number | null;
    weatherCode: number;
  }[];
}

interface ForecastResponse {
  current: { temperature_2m: number; weather_code: number; is_day: number };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    weather_code: number[];
  };
}

/** O tempo de agora e dos próximos 5 dias, pelo Open-Meteo (o weather_code é o da WMO). */
export async function fetchForecast(location: {
  latitude: number;
  longitude: number;
  timezone: string;
}): Promise<Forecast> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('timezone', location.timezone);
  url.searchParams.set('current', 'temperature_2m,weather_code,is_day');
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
  );
  url.searchParams.set('forecast_days', '5');
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`O Open-Meteo respondeu ${response.status}.`);
  }
  const data = (await response.json()) as ForecastResponse;
  return {
    current: {
      temperature: Math.round(data.current.temperature_2m),
      weatherCode: data.current.weather_code,
      isDay: data.current.is_day === 1,
    },
    daily: data.daily.time.map((date, index) => ({
      date,
      max: Math.round(data.daily.temperature_2m_max[index]),
      min: Math.round(data.daily.temperature_2m_min[index]),
      rainChance: data.daily.precipitation_probability_max[index] ?? null,
      weatherCode: data.daily.weather_code[index],
    })),
  };
}
