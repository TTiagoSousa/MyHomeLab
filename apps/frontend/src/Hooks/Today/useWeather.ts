import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';

export interface Weather_Place {
  name: string;
  country: string | null;
}

export interface Weather_Forecast {
  current: { temperature: number; weatherCode: number; isDay: boolean };
  daily: { date: string; max: number; min: number; rainChance: number | null; weatherCode: number }[];
}

const errorMessage = (error: any) =>
  error.response?.data?.message || error.message || i18n.t('common:errors.generic');

export const useWeather = () => {
  const [place, setPlace] = useState<Weather_Place | null>(null);
  const [forecast, setForecast] = useState<Weather_Forecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWeather = async () => {
    setLoading(true);
    try {
      const response = await http.get(End_Points.Today_Weather_Endpoint(), { withCredentials: true });
      setPlace(response.data.location);
      setForecast(response.data.forecast);
      setError('');
    } catch (error: any) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const saveCity = async (city: string): Promise<string> => {
    try {
      const response = await http.put(End_Points.Today_Weather_Endpoint(), { city }, { withCredentials: true });
      setPlace(response.data);
      setForecast(null);
      return '';
    } catch (error: any) {
      return errorMessage(error);
    }
  };

  const clearCity = async (): Promise<string> => {
    try {
      await http.delete(End_Points.Today_Weather_Endpoint(), { withCredentials: true });
      setPlace(null);
      setForecast(null);
      return '';
    } catch (error: any) {
      return errorMessage(error);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  return { place, forecast, loading, error, saveCity, clearCity };
};
