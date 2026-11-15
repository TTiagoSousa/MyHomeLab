import { useTranslation } from 'react-i18next';
import type { Workout } from '../../../../Hooks/Health/healthTypes';
import Health_Table_Head from '../Shared/Health_Table_Head';
import Exercise_Workout_Row from './Exercise_Workout_Row';
import { toSessions, workoutColumns } from './exerciseFormat';

interface Exercise_Workouts_Panel_Props {
  workouts: Workout[];
  onOpen: (id: string) => void;
  onSeeAll: () => void;
}

const Exercise_Workouts_Panel = ({ workouts, onOpen, onSeeAll }: Exercise_Workouts_Panel_Props) => {
  const { t } = useTranslation('health');
  const sessions = toSessions(workouts);

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('exercise.workoutsCount', { count: sessions.length })}</span>
          <p className='Health_card_description'>{t('exercise.workoutsDescription')}</p>
        </div>
        <button type='button' className='Health_see_all' onClick={onSeeAll}>
          {t('exercise.seeAll')}
        </button>
      </div>

      {sessions.length ? (
        <div className='Health_Table exercise'>
          <Health_Table_Head columns={workoutColumns(t)} />
          <div className='Health_Table_Body'>
            {sessions.map((workout) => (
              <Exercise_Workout_Row
                key={workout.id}
                workout={workout}
                parts={workout.sessionParts}
                onOpen={() => onOpen(workout.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <span className='Health_chart_empty'>{t('exercise.noWorkouts')}</span>
      )}
    </section>
  );
};

export default Exercise_Workouts_Panel;
