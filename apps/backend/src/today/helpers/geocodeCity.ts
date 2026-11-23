import { NotFoundException } from '@nestjs/common';

export interface GeocodedCity {
  name: string;
  country: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
}

interface GeocodingResponse {
  results?: {
    name: string;
    country?: string;
    latitude: number;
    longitude: number;
    timezone?: string;
  }[];
}

/** A cidade pelo geocoding do Open-Meteo (grátis, sem chave): a primeira que encontrar. */
export async function geocodeCity(city: string): Promise<GeocodedCity> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', city.trim());
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'pt');
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`O Open-Meteo respondeu ${response.status}.`);
  }
  const found = ((await response.json()) as GeocodingResponse).results?.[0];
  if (!found) {
    throw new NotFoundException(`Não encontrei a cidade "${city.trim()}".`);
  }
  return {
    name: found.name,
    country: found.country ?? null,
    latitude: found.latitude,
    longitude: found.longitude,
    timezone: found.timezone ?? 'auto',
  };
}
