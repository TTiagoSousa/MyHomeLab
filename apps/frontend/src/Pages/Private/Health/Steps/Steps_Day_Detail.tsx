import { useTranslation } from 'react-i18next';
import { useStepsDay } from '../../../../Hooks/Health/useStepsDay';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay, formatDistance, formatDuration, formatSteps } from '../Shared/healthFormat';
import Steps_Goal_Bar from './Steps_Goal_Bar';
import Steps_Hourly_Chart from './Steps_Hourly_Chart';
import { STEP_GOAL, busiestHour, goalShare } from './stepsFormat';

interface Steps_Day_Detail_Props {
  dayId: string | null;
}

const Steps_Day_Detail = ({ dayId }: Steps_Day_Detail_Props) => {
  const { t } = useTranslation('health');
  const { stepsDay, loading, error } = useStepsDay(dayId);

  if (!dayId) return <section className='Health_card empty'>{t('steps.selectDay')}</section>;
  if (error) return <section className='Health_card empty'>{error}</section>;
  if (!stepsDay) return <section className='Health_card empty'>{loading ? t('loading') : ''}</section>;

  const peak = busiestHour(stepsDay.hourly);
  const pace = stepsDay.activeMinutes ? Math.round(stepsDay.steps / stepsDay.activeMinutes) : null;
  const left = Math.max(STEP_GOAL - stepsDay.steps, 0);

  return (
    <section className={`Health_card ${loading ? 'loading' : ''}`}>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('steps.dayOf', { date: formatDay(stepsDay.day) })}</span>
          <p className='Health_card_description'>
            {left
              ? t('steps.dayLeft', { steps: formatSteps(stepsDay.steps), left: formatSteps(left) })
              : t('steps.dayGoal', { steps: formatSteps(stepsDay.steps) })}
          </p>
        </div>
      </div>

      <div className='Health_Box'>
        <span className='Health_Section_Label'>{t('steps.chartTitle')}</span>
        {stepsDay.hourly?.some((steps) => steps > 0) ? (
          <Error_Boundary>
            <Steps_Hourly_Chart hourly={stepsDay.hourly} />
          </Error_Boundary>
        ) : (
          <span className='Health_chart_empty'>{t('steps.noHourly')}</span>
        )}
        <Steps_Goal_Bar steps={stepsDay.steps} />
      </div>

      <div className='Health_Stats columns-5'>
        <Health_Stat
          highlight
          label={t('steps.metrics.daySteps')}
          value={formatSteps(stepsDay.steps)}
          sub={t('steps.metrics.goalShare', { value: goalShare(stepsDay.steps) })}
        />
        <Health_Stat label={t('steps.metrics.dayDistance')} value={formatDistance(stepsDay.distanceM)} />
        <Health_Stat label={t('steps.metrics.dayCalories')} value={`${stepsDay.calories} kcal`} />
        <Health_Stat label={t('steps.metrics.dayActive')} value={formatDuration(stepsDay.activeMinutes)} />
        <Health_Stat
          label={t('steps.metrics.busiestHour')}
          value={peak == null ? '—' : `${String(peak).padStart(2, '0')}:00`}
          sub={pace ? t('steps.metrics.paceSub', { value: pace }) : undefined}
        />
      </div>
    </section>
  );
};

export default Steps_Day_Detail;
