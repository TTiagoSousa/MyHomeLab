const WEATHER_GROUPS: { codes: number[]; key: string; day: string; night: string }[] = [
  { codes: [0], key: 'clear', day: '☀️', night: '🌙' },
  { codes: [1, 2], key: 'partly', day: '⛅', night: '☁️' },
  { codes: [3], key: 'cloudy', day: '☁️', night: '☁️' },
  { codes: [45, 48], key: 'fog', day: '🌫️', night: '🌫️' },
  { codes: [51, 53, 55, 56, 57], key: 'drizzle', day: '🌦️', night: '🌧️' },
  { codes: [61, 63, 65, 66, 67, 80, 81, 82], key: 'rain', day: '🌧️', night: '🌧️' },
  { codes: [71, 73, 75, 77, 85, 86], key: 'snow', day: '❄️', night: '❄️' },
  { codes: [95, 96, 99], key: 'storm', day: '⛈️', night: '⛈️' },
];

export const weatherOf = (code: number, isDay = true) => {
  const group = WEATHER_GROUPS.find((item) => item.codes.includes(code)) ?? WEATHER_GROUPS[2];
  return { key: group.key, symbol: isDay ? group.day : group.night };
};
