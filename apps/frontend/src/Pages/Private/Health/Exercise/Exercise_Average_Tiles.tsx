import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import type { ExerciseAverages } from '../../../../Hooks/Health/healthTypes';
import Health_Split_Bar from '../Shared/Health_Split_Bar';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay, formatDistance, formatDuration, valueOrDash } from '../Shared/healthFormat';
import { SPORT_CLASSES, rankSports, typeName } from './exerciseFormat';

interface Exercise_Average_Tiles_Props {
  averages: ExerciseAverages;
  detailed?: boolean;
}

const Exercise_Average_Tiles = ({ averages, detailed = false }: Exercise_Average_Tiles_Props) => {
  const { t } = useTranslation('health');
  const sports = rankSports(averages.workoutsByType).map((code) => [code, averages.workoutsByType[code]] as const);
  const onDay = (day: string | null) => (day ? t('exercise.metrics.onDay', { date: formatDay(day, false) }) : undefined);

  return (
    <div className='Health_Block'>
      <div className='Health_Stats columns-4'>
        <Health_Stat
          highlight
          label={t('exercise.metrics.workouts')}
          value={String(averages.workouts)}
          sub={averages.perWeek == null ? undefined : t('exercise.metrics.perWeek', { value: averages.perWeek })}
        />
        <Health_Stat
          label={t('exercise.metrics.totalTime')}
          value={formatDuration(averages.totalMinutes)}
          sub={averages.avgMinutes == null ? undefined : t('exercise.metrics.avgTime', { duration: formatDuration(averages.avgMinutes) })}
        />
        <Health_Stat label={t('exercise.metrics.workoutCalories')} value={`${averages.totalCalories} kcal`} />
        <Health_Stat label={t('exercise.metrics.avgHeart')} value={valueOrDash(averages.avgHeartRate, ` ${t('units.bpm')}`)} />
      </div>

      <div className='Health_Box'>
        <span className='Health_Section_Label'>{t('exercise.metrics.byType')}</span>
        {sports.length ? (
          <Health_Split_Bar
            showLegend
            parts={sports.map(([typeId, count], index) => ({
              key: typeId,
              label: typeName(t, typeId),
              value: count,
              className: SPORT_CLASSES[index % SPORT_CLASSES.length],
              display: String(count),
            }))}
          />
        ) : (
          <span className='Health_chart_empty'>{t('exercise.noWorkouts')}</span>
        )}
      </div>

      {detailed && (
        <div className='Health_Stats columns-4'>
          <Health_Stat
            label={t('exercise.metrics.intense')}
            value={formatDuration(averages.intenseMinutes)}
            sub={t('exercise.metrics.intenseSub')}
          />
          <Health_Stat
            label={t('exercise.metrics.longest')}
            value={formatDuration(averages.longestMinutes)}
            sub={
              averages.longestType != null && averages.longestDay
                ? `${typeName(t, averages.longestType)} · ${formatDay(averages.longestDay, false)}`
                : undefined
            }
          />
          <Health_Stat
            label={t('exercise.metrics.peakHeart')}
            value={valueOrDash(averages.peakHeartRate, ` ${t('units.bpm')}`)}
            sub={onDay(averages.peakDay)}
          />
          <Health_Stat label={t('exercise.metrics.totalDistance')} value={formatDistance(averages.totalDistanceM)} />
        </div>
      )}
    </div>
  );
};

export default Exercise_Average_Tiles;
