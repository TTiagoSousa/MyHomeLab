import { useTranslation } from 'react-i18next';
import type { WorkoutsSyncResult } from '../../../../Hooks/Health/useExercise';

interface Exercise_Sync_Result_Props {
  result: WorkoutsSyncResult;
}

const Exercise_Sync_Result = ({ result }: Exercise_Sync_Result_Props) => {
  const { t } = useTranslation('health');

  return (
    <div className='Exercise_Sync_Note' role='status'>
      {result.checked ? (
        <>
          <strong>{t('workoutSync.resultChecked', { count: result.checked })}</strong>
          <span>{t('workoutSync.resultHeart', { count: result.heart })}</span>
          <span>{t('workoutSync.resultCalories', { count: result.calories })}</span>
        </>
      ) : (
        <span>{t('workoutSync.resultNone')}</span>
      )}
    </div>
  );
};

export default Exercise_Sync_Result;
