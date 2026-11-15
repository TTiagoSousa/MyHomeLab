import { useTranslation } from 'react-i18next';
import './Workout_Form.scss';
import type { WorkoutSync } from '../../../Hooks/Health/healthTypes';

interface Workout_Sync_Result_Props {
  sync: WorkoutSync | null;
  onClose: () => void;
}

const Workout_Sync_Result = ({ sync, onClose }: Workout_Sync_Result_Props) => {
  const { t } = useTranslation('health');
  const heart = Boolean(sync?.heart);
  const calories = Boolean(sync?.calories);

  return (
    <div className='Workout_Sync_Result'>
      <span className='Workout_Sync_Result_Title'>{t('workoutForm.sync.title')}</span>
      <ul>
        <li className={heart ? 'ok' : 'pending'}>
          <b>{heart ? '✓' : '…'}</b>
          {heart ? t('workoutForm.sync.heart') : t('workoutForm.sync.noHeart')}
        </li>
        {heart && (
          <li className={calories ? 'ok' : 'neutral'}>
            <b>{calories ? '✓' : '–'}</b>
            {calories ? t('workoutForm.sync.calories') : t('workoutForm.sync.noCalories')}
          </li>
        )}
      </ul>
      <button type='button' className='Workout_Sync_Result_Close' onClick={onClose}>
        {t('workoutForm.sync.close')}
      </button>
    </div>
  );
};

export default Workout_Sync_Result;
