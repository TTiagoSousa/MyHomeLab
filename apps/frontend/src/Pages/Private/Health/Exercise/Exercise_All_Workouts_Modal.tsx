import { useTranslation } from 'react-i18next';
import { useExercise } from '../../../../Hooks/Health/useExercise';
import Health_Month_Modal from '../Shared/Health_Month_Modal';
import Exercise_Workout_Row from './Exercise_Workout_Row';
import { toSessions, workoutColumns } from './exerciseFormat';

interface Exercise_All_Workouts_Modal_Props {
  onOpen: (id: string) => void;
  onClose: () => void;
}

const Exercise_All_Workouts_Modal = ({ onOpen, onClose }: Exercise_All_Workouts_Modal_Props) => {
  const { t } = useTranslation('health');
  const { workouts, loading } = useExercise(0);
  const sessions = toSessions(workouts);

  return (
    <Health_Month_Modal
      title={t('exercise.allWorkouts', { count: sessions.length })}
      description={t('exercise.allWorkoutsDescription')}
      loading={loading}
      items={sessions}
      tableClass='exercise'
      columns={workoutColumns(t)}
      monthOf={(workout) => workout.day.slice(0, 7)}
      countLabel={(count) => t('exercise.workoutsCount', { count })}
      onClose={onClose}
      renderRow={(workout) => (
        <Exercise_Workout_Row
          key={workout.id}
          workout={workout}
          parts={workout.sessionParts}
          onOpen={() => onOpen(workout.id)}
        />
      )}
    />
  );
};

export default Exercise_All_Workouts_Modal;
