import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { dateLocale } from '../../../i18n';
import { useWeather } from '../../../Hooks/Today/useWeather';
import { weatherOf } from './weatherCodes';

const dayName = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(dateLocale(), { weekday: 'short' });

const Today_Weather = () => {
  const { t } = useTranslation('tasks');
  const navigate = useNavigate();
  const { place, forecast, loading, error } = useWeather();

  if (loading) {
    return <section className='Today_Weather Today_Weather_Muted'>{t('common:state.loading')}</section>;
  }

  if (!place) {
    return (
      <section className='Today_Weather Today_Weather_Muted'>
        <span>{t('today.weather.noCity')}</span>
        <button type='button' className='Today_Ghost_Button' onClick={() => navigate('/MyHomeLab/Settings')}>
          {t('today.weather.chooseCity')}
        </button>
      </section>
    );
  }

  if (error || !forecast) {
    return (
      <section className='Today_Weather Today_Weather_Muted' role='alert'>
        {error || t('common:errors.generic')}
      </section>
    );
  }

  const now = weatherOf(forecast.current.weatherCode, forecast.current.isDay);
  const [today, ...nextDays] = forecast.daily;

  return (
    <section className='Today_Weather' aria-label={t('today.weather.title')}>
      <div className='Today_Weather_Now'>
        <span className='Today_Weather_Symbol' aria-hidden='true'>{now.symbol}</span>
        <span className='Today_Weather_Temperature'>{forecast.current.temperature}°</span>
        <div className='Today_Weather_Place'>
          <strong>{place.name}</strong>
          <span>{t(`today.weather.codes.${now.key}`)}</span>
        </div>
      </div>

      {today && (
        <p className='Today_Weather_Range'>
          {t('today.weather.range', { max: today.max, min: today.min })}
          {today.rainChance !== null && ` · ${t('today.weather.rain', { chance: today.rainChance })}`}
        </p>
      )}

      <ul className='Today_Weather_Days'>
        {nextDays.map((day) => {
          const weather = weatherOf(day.weatherCode);
          return (
            <li key={day.date} title={t(`today.weather.codes.${weather.key}`)}>
              <span className='Today_Weather_Day'>{dayName(day.date)}</span>
              <span aria-hidden='true'>{weather.symbol}</span>
              <span>{day.max}° / {day.min}°</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default Today_Weather;
