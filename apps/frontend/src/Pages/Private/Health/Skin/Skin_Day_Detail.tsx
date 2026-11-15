import { useTranslation } from 'react-i18next';
import { useSkinTemperatureDay } from '../../../../Hooks/Health/useSkinTemperatureDay';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Day_Chart from '../Shared/Health_Day_Chart';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay, minuteClock, percentOf } from '../Shared/healthFormat';
import Skin_Range_Bar from './Skin_Range_Bar';
import { RANGE_ORDER, SKIN_COLORS, formatTemp, rangesTotal, temperatureYMin } from './skinFormat';

interface Skin_Day_Detail_Props {
  dayId: string | null;
}

const Skin_Day_Detail = ({ dayId }: Skin_Day_Detail_Props) => {
  const { t } = useTranslation('health');
  const { temperatureDay, loading, error } = useSkinTemperatureDay(dayId);

  if (!dayId) return <section className='Health_card empty'>{t('skin.selectDay')}</section>;
  if (error) return <section className='Health_card empty'>{error}</section>;
  if (!temperatureDay) return <section className='Health_card empty'>{loading ? t('loading') : ''}</section>;

  const total = rangesTotal(temperatureDay.ranges);
  const spread = temperatureDay.maxTemp - temperatureDay.minTemp;

  return (
    <section className={`Health_card ${loading ? 'loading' : ''}`}>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('skin.dayOf', { date: formatDay(temperatureDay.day) })}</span>
          <p className='Health_card_description'>
            {t('skin.dayDescription', { average: formatTemp(temperatureDay.avgTemp), count: temperatureDay.samples })}
          </p>
        </div>
      </div>

      <div className='Health_Box'>
        <span className='Health_Section_Label'>{t('skin.chartTitle')}</span>
        {temperatureDay.points.length ? (
          <Error_Boundary>
            <Health_Day_Chart
              name={t('skin.series.temperature')}
              points={temperatureDay.points}
              color={SKIN_COLORS.line}
              areaColor={SKIN_COLORS.area}
              format={formatTemp}
              yMin={temperatureYMin}
              gapMinutes={30}
              references={
                temperatureDay.nightAvg != null
                  ? [{ name: t('skin.series.night'), value: temperatureDay.nightAvg, color: SKIN_COLORS.night }]
                  : []
              }
            />
          </Error_Boundary>
        ) : (
          <span className='Health_chart_empty'>{t('skin.noPoints')}</span>
        )}
        <div className='Health_Chart_Legend'>
          <span>
            <i className='line skin' />
            {t('skin.series.temperature')}
          </span>
          {temperatureDay.nightAvg != null && (
            <span>
              <i className='line night' />
              {t('skin.series.night')}
            </span>
          )}
        </div>
        <Skin_Range_Bar ranges={temperatureDay.ranges} showLegend />
      </div>

      <div className='Health_Stats columns-5'>
        <Health_Stat highlight label={t('skin.metrics.night')} value={formatTemp(temperatureDay.nightAvg)} />
        <Health_Stat label={t('skin.metrics.average')} value={formatTemp(temperatureDay.avgTemp)} />
        <Health_Stat
          label={t('skin.metrics.min')}
          value={formatTemp(temperatureDay.minTemp)}
          sub={t('skin.metrics.at', { time: minuteClock(temperatureDay.minAt) })}
        />
        <Health_Stat
          label={t('skin.metrics.max')}
          value={formatTemp(temperatureDay.maxTemp)}
          sub={t('skin.metrics.at', { time: minuteClock(temperatureDay.maxAt) })}
        />
        <Health_Stat label={t('skin.metrics.daySpread')} value={`${spread.toFixed(1)} °C`} />
      </div>

      <div className='Health_Stats columns-5'>
        <Health_Stat label={t('skin.metrics.samples')} value={String(temperatureDay.samples)} />
        {RANGE_ORDER.map((key) => (
          <Health_Stat
            key={key}
            label={t(`skin.ranges.${key}`)}
            value={`${percentOf(temperatureDay.ranges[key] ?? 0, total)}%`}
            sub={t('skin.metrics.readings', { count: temperatureDay.ranges[key] ?? 0 })}
          />
        ))}
      </div>
    </section>
  );
};

export default Skin_Day_Detail;
