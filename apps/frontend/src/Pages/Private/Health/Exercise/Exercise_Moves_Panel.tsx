import { useTranslation } from 'react-i18next';
import type { ExerciseTotal } from '../../../../Hooks/Health/healthTypes';
import { exerciseName, formatSeconds, formatWeight } from './exerciseFormat';

interface Exercise_Moves_Panel_Props {
  moves: ExerciseTotal[];
}

const Exercise_Moves_Panel = ({ moves }: Exercise_Moves_Panel_Props) => {
  const { t } = useTranslation('health');

  const totalOf = (move: ExerciseTotal) =>
    [
      move.reps ? `${move.reps} ${t('exercise.units.reps')}` : null,
      move.seconds ? (move.seconds < 60 ? `${move.seconds} ${t('exercise.units.seconds')}` : formatSeconds(move.seconds)) : null,
    ]
      .filter(Boolean)
      .join(' · ') || '—';

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('exercise.openGym.movesTitle')}</span>
          <p className='Health_card_description'>{t('exercise.openGym.movesDescription')}</p>
        </div>
      </div>

      <div className='Health_Exercise_List moves'>
        <div className='Health_Exercise_Item Health_Exercise_Head'>
          <span>{t('exercise.openGym.exercise')}</span>
          <span>{t('exercise.openGym.movesWorkouts')}</span>
          <span>{t('exercise.openGym.movesSets')}</span>
          <span>{t('exercise.openGym.total')}</span>
          <span>{t('exercise.openGym.movesMaxWeight')}</span>
        </div>
        {moves.map((move) => (
          <div className='Health_Exercise_Item' key={move.id}>
            <span className='Health_Exercise_Name'>
              {exerciseName(move)}
              {move.records > 0 && (
                <em className='Exercise_Record'>{t('exercise.openGym.records', { count: move.records })}</em>
              )}
            </span>
            <span>{move.workouts}</span>
            <span>{move.sets}</span>
            <span className='Health_Exercise_Sets'>{totalOf(move)}</span>
            <span>{move.maxWeightKg == null ? '—' : formatWeight(move.maxWeightKg)}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Exercise_Moves_Panel;
