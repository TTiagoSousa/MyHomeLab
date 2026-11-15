import { useTranslation } from 'react-i18next';
import type { WorkoutDetail } from '../../../../Hooks/Health/healthTypes';
import type { WorkoutSyncResult } from '../../../../Hooks/Health/useWorkout';
import { dateLocale } from '../../../../i18n';

interface Exercise_Workout_Sync_Props {
  workout: WorkoutDetail;
  syncing: boolean;
  result: WorkoutSyncResult | null;
  onSync: () => void;
}

const syncedLabel = (iso: string) =>
  new Date(iso).toLocaleString(dateLocale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const Exercise_Workout_Sync = ({ workout, syncing, result, onSync }: Exercise_Workout_Sync_Props) => {
  const { t } = useTranslation('health');

  const outcome = () => {
    if (!result) return null;
    if (!result.heart && !result.calories) return t('workoutSync.foundNothing');
    return [result.heart ? t('workoutSync.foundHeart') : null, result.calories ? t('workoutSync.foundCalories') : null]
      .filter(Boolean)
      .join(' ');
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('workoutSync.title')}</span>
          <p className='Health_card_description'>{t('workoutSync.description')}</p>
        </div>
        <button type='button' className='Health_see_all' disabled={syncing} onClick={onSync}>
          {syncing ? t('workoutSync.fetching') : t('workoutSync.fetch')}
        </button>
      </div>

      <div className='Exercise_Sync_Note'>
        <span>
          {workout.syncedAt
            ? t('workoutSync.syncedAt', { date: syncedLabel(workout.syncedAt) })
            : t('workoutSync.neverSynced')}
        </span>
        {result && (
          <strong className={result.heart || result.calories ? 'found' : 'missing'} role='status'>
            {outcome()}
          </strong>
        )}
      </div>
    </section>
  );
};

export default Exercise_Workout_Sync;
