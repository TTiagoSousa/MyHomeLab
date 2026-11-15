import { useTranslation } from 'react-i18next';
import type { WorkoutDetail } from '../../../../Hooks/Health/healthTypes';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Stat from '../Shared/Health_Stat';
import { valueOrDash } from '../Shared/healthFormat';
import Exercise_Context_Chart from './Exercise_Context_Chart';
import { CONTEXT_COLORS } from './exerciseFormat';

interface Exercise_Workout_Context_Props {
  workout: WorkoutDetail;
}

const Exercise_Workout_Context = ({ workout }: Exercise_Workout_Context_Props) => {
  const { t } = useTranslation('health');
  const { context } = workout;
  const bpm = ` ${t('units.bpm')}`;
  const celsius = (value: number) => `${value.toFixed(1)} °C`;
  const percent = (value: number) => `${value}%`;

  const charts = [
    { key: 'skin', points: context.skinTemperature, color: CONTEXT_COLORS.skin, format: celsius },
    { key: 'oxygen', points: context.bloodOxygen, color: CONTEXT_COLORS.oxygen, format: percent },
    { key: 'stress', points: context.stress, color: CONTEXT_COLORS.stress, format: (value: number) => String(value) },
  ].filter((chart) => chart.points?.length);

  const restingDiff =
    context.restingBpm != null && workout.avgHeartRate != null ? workout.avgHeartRate - context.restingBpm : null;

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('exercise.context.title')}</span>
          <p className='Health_card_description'>{t('exercise.context.description')}</p>
        </div>
      </div>

      <div className='Health_Stats columns-4'>
        <Health_Stat
          label={t('exercise.context.resting')}
          value={valueOrDash(context.restingBpm, bpm)}
          sub={restingDiff != null ? t('exercise.context.restingSub', { value: restingDiff }) : undefined}
        />
        <Health_Stat
          label={t('exercise.context.skin')}
          value={context.skinSummary ? celsius(context.skinSummary.avg) : '—'}
          sub={
            context.skinSummary
              ? t('exercise.context.range', { min: celsius(context.skinSummary.min), max: celsius(context.skinSummary.max) })
              : t('exercise.context.noData')
          }
        />
        <Health_Stat
          label={t('exercise.context.oxygen')}
          value={context.oxygenSummary ? percent(context.oxygenSummary.avg) : '—'}
          sub={
            context.oxygenSummary
              ? t('exercise.context.lowest', { value: percent(context.oxygenSummary.min) })
              : t('exercise.context.noData')
          }
        />
        <Health_Stat
          label={t('exercise.context.stress')}
          value={context.stressSummary ? String(context.stressSummary.avg) : '—'}
          sub={
            context.stressSummary
              ? t('exercise.context.highest', { value: context.stressSummary.max })
              : t('exercise.context.noData')
          }
        />
      </div>

      {charts.map((chart) => (
        <div key={chart.key} className='Health_Box'>
          <span className='Health_Section_Label'>{t(`exercise.context.${chart.key}`)}</span>
          <Error_Boundary>
            <Exercise_Context_Chart
              name={t(`exercise.context.${chart.key}`)}
              points={chart.points!}
              color={chart.color}
              durationSec={workout.durationSec}
              format={chart.format}
            />
          </Error_Boundary>
        </div>
      ))}
    </section>
  );
};

export default Exercise_Workout_Context;
