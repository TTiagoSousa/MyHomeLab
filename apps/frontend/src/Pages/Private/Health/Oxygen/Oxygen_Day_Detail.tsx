import { useTranslation } from 'react-i18next';
import { useBloodOxygenDay } from '../../../../Hooks/Health/useBloodOxygenDay';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Day_Chart from '../Shared/Health_Day_Chart';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay, minuteClock, percentOf } from '../Shared/healthFormat';
import Oxygen_Range_Bar from './Oxygen_Range_Bar';
import { OXYGEN_COLORS, RANGE_ORDER, formatSpo2, oxygenYMin, rangesTotal } from './oxygenFormat';

interface Oxygen_Day_Detail_Props {
  dayId: string | null;
}

const Oxygen_Day_Detail = ({ dayId }: Oxygen_Day_Detail_Props) => {
  const { t } = useTranslation('health');
  const { oxygenDay, loading, error } = useBloodOxygenDay(dayId);

  if (!dayId) return <section className='Health_card empty'>{t('oxygen.selectDay')}</section>;
  if (error) return <section className='Health_card empty'>{error}</section>;
  if (!oxygenDay) return <section className='Health_card empty'>{loading ? t('loading') : ''}</section>;

  const total = rangesTotal(oxygenDay.ranges);

  return (
    <section className={`Health_card ${loading ? 'loading' : ''}`}>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('oxygen.dayOf', { date: formatDay(oxygenDay.day) })}</span>
          <p className='Health_card_description'>
            {t('oxygen.dayDescription', { average: formatSpo2(oxygenDay.avgSpo2, 1), count: oxygenDay.samples })}
          </p>
        </div>
      </div>

      <div className='Health_Box'>
        <span className='Health_Section_Label'>{t('oxygen.chartTitle')}</span>
        {oxygenDay.points.length ? (
          <Error_Boundary>
            <Health_Day_Chart
              name={t('oxygen.series.spo2')}
              points={oxygenDay.points}
              color={OXYGEN_COLORS.line}
              areaColor={OXYGEN_COLORS.area}
              format={(value) => formatSpo2(value)}
              yMin={oxygenYMin}
              gapMinutes={240}
              showPoints
              references={
                oxygenDay.nightAvg != null
                  ? [{ name: t('oxygen.series.night'), value: oxygenDay.nightAvg, color: OXYGEN_COLORS.night }]
                  : []
              }
            />
          </Error_Boundary>
        ) : (
          <span className='Health_chart_empty'>{t('oxygen.noPoints')}</span>
        )}
        <div className='Health_Chart_Legend'>
          <span>
            <i className='line oxygen' />
            {t('oxygen.series.spo2')}
          </span>
          {oxygenDay.nightAvg != null && (
            <span>
              <i className='line night' />
              {t('oxygen.series.night')}
            </span>
          )}
        </div>
        <Oxygen_Range_Bar ranges={oxygenDay.ranges} showLegend />
      </div>

      <div className='Health_Stats columns-5'>
        <Health_Stat highlight label={t('oxygen.metrics.average')} value={formatSpo2(oxygenDay.avgSpo2, 1)} />
        <Health_Stat label={t('oxygen.metrics.night')} value={formatSpo2(oxygenDay.nightAvg, 1)} />
        <Health_Stat
          label={t('oxygen.metrics.min')}
          value={formatSpo2(oxygenDay.minSpo2)}
          sub={t('oxygen.metrics.at', { time: minuteClock(oxygenDay.minAt) })}
        />
        <Health_Stat
          label={t('oxygen.metrics.max')}
          value={formatSpo2(oxygenDay.maxSpo2)}
          sub={t('oxygen.metrics.at', { time: minuteClock(oxygenDay.maxAt) })}
        />
        <Health_Stat label={t('oxygen.metrics.samples')} value={String(oxygenDay.samples)} />
      </div>

      <div className='Health_Stats columns-4'>
        {RANGE_ORDER.map((key) => (
          <Health_Stat
            key={key}
            label={t(`oxygen.ranges.${key}`)}
            value={`${percentOf(oxygenDay.ranges[key] ?? 0, total)}%`}
            sub={t('oxygen.metrics.readings', { count: oxygenDay.ranges[key] ?? 0 })}
          />
        ))}
      </div>
    </section>
  );
};

export default Oxygen_Day_Detail;
