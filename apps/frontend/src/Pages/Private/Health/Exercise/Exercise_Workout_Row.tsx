import { useTranslation } from 'react-i18next';
import type { Workout } from '../../../../Hooks/Health/healthTypes';
import { formatDay, localClock, valueOrDash } from '../Shared/healthFormat';
import Exercise_Effort_Bar from './Exercise_Effort_Bar';
import { formatDistance, formatWorkoutDuration, typeName } from './exerciseFormat';

interface Exercise_Workout_Row_Props {
  workout: Workout;
  parts?: Workout[];
  onOpen: () => void;
}

const Exercise_Workout_Row = ({ workout, parts = [], onOpen }: Exercise_Workout_Row_Props) => {
  const { t } = useTranslation('health');
  const bpm = ` ${t('units.bpm')}`;

  return (
    <button type='button' className='Health_Table_Row' onClick={onOpen}>
      <span className='Health_Table_Day'>
        {formatDay(workout.day)} · {localClock(workout.startAt, workout.timeZone)}
      </span>
      <span className={`Health_Table_Strong Health_Table_Day${parts.length ? ' Exercise_Session_Cell' : ''}`}>
        {workout.title ?? typeName(t, workout.typeId)}
        {workout.hasRoute && <em className='gps'>{t('exercise.gps')}</em>}
        {workout.source === 'MANUAL' && <em className='gps'>{t('exercise.manual.badge')}</em>}
        {workout.source === 'OPENGYM' && <em className='gps'>{t('exercise.openGym.badge')}</em>}
        {parts.length > 0 && (
          <small className='Exercise_Session_Parts'>
            {parts
              .map((part) => `+ ${part.title ?? typeName(t, part.typeId)} (${t(`sessions.roles.${part.partRole ?? 'PART'}`)})`)
              .join(' ')}
          </small>
        )}
      </span>
      <span>{formatWorkoutDuration(workout.durationSec)}</span>
      <span className='Health_Table_Optional'>{formatDistance(workout.distanceM)}</span>
      <span>{valueOrDash(workout.calories, ' kcal')}</span>
      <span className='Health_Table_Optional'>{valueOrDash(workout.avgHeartRate, bpm)}</span>
      <span className='Health_Table_Optional'>{valueOrDash(workout.maxHeartRate, bpm)}</span>
      <span className='Health_Table_Bar'>
        <Exercise_Effort_Bar zones={workout.heartZones} />
      </span>
    </button>
  );
};

export default Exercise_Workout_Row;
