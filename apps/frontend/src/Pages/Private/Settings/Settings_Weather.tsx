import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import { useWeather } from '../../../Hooks/Today/useWeather';

const Settings_Weather = () => {
  const { t } = useTranslation('settings');
  const { place, loading, saveCity, clearCity } = useWeather();
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const run = async (work: () => Promise<string>) => {
    setSaving(true);
    const problem = await work();
    setSaving(false);
    setMessage(problem);
    if (!problem) setCity('');
  };

  return (
    <div className='Settings_section'>
      <div className='Settings_section_title'>{t('weather.title')}</div>
      <p className='Settings_section_description'>{t('weather.description')}</p>

      {!loading && (
        <p className='Settings_weather_current'>
          {place
            ? t('weather.current', { city: place.country ? `${place.name}, ${place.country}` : place.name })
            : t('weather.none')}
        </p>
      )}

      <form
        className='Settings_weather_form'
        onSubmit={(event) => {
          event.preventDefault();
          if (city.trim()) void run(() => saveCity(city.trim()));
        }}
      >
        <Global_Input
          id='settings-weather-city'
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder={t('weather.placeholder')}
          maxLength={80}
        />
        <button type='submit' className='Settings_weather_save' disabled={saving || city.trim().length < 2}>
          {saving ? t('common:state.saving') : t('common:actions.save')}
        </button>
        {place && (
          <button type='button' className='Settings_weather_clear' disabled={saving} onClick={() => void run(clearCity)}>
            {t('weather.clear')}
          </button>
        )}
      </form>

      {message && <p className='Settings_weather_error' role='alert'>{message}</p>}
    </div>
  );
};

export default Settings_Weather;
