import { useTranslation } from 'react-i18next';
import type { WorkoutExerciseLog, WorkoutSetLog } from '../../../../Hooks/Health/healthTypes';
import { exerciseInfo, exerciseName, formatRest, formatWeight, plannedText, setAmount } from './exerciseFormat';

interface Exercise_Workout_Exercises_Props {
  exercises: WorkoutExerciseLog[];
  title?: string | null;
}

const effortOf = (set: WorkoutSetLog) =>
  set.rir != null ? `RIR ${set.rir}` : set.rpe != null ? `RPE ${set.rpe}` : '—';

const Exercise_Workout_Exercises = ({ exercises, title }: Exercise_Workout_Exercises_Props) => {
  const { t } = useTranslation('health');

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{title ?? t('exercise.openGym.exercisesTitle')}</span>
          <p className='Health_card_description'>{t('exercise.openGym.exercisesDescription')}</p>
        </div>
      </div>

      <div className='Exercise_Log'>
        {exercises.map((exercise, index) => {
          const info = exerciseInfo(exercise);
          const planned = plannedText(t, exercise);
          let setNumber = 0;
          return (
            <div className='Exercise_Log_Item' key={`${exercise.id}-${index}`}>
              <div className='Exercise_Log_Head'>
                <span className='Health_Exercise_Name'>
                  {exerciseName(exercise)}
                  {exercise.record && <em className='Exercise_Record'>{t('exercise.openGym.record')}</em>}
                  {info && <small className='Exercise_Item_Details'>{info}</small>}
                </span>
                {planned && <span className='Exercise_Log_Planned'>{t('exercise.openGym.planned', { value: planned })}</span>}
              </div>

              {exercise.sets.length ? (
                <div className='Exercise_Log_Sets'>
                  <div className='Exercise_Log_Set Health_Exercise_Head'>
                    <span>{t('exercise.openGym.set')}</span>
                    <span>{t(exercise.mode === 'time' ? 'exercise.openGym.time' : 'exercise.openGym.reps')}</span>
                    <span>{t('exercise.openGym.weight')}</span>
                    <span>{t('exercise.openGym.effort')}</span>
                    <span>{t('exercise.openGym.rest')}</span>
                  </div>
                  {exercise.sets.map((set, setIndex) => {
                    if (!set.warmup) setNumber++;
                    return (
                      <div className={`Exercise_Log_Set${set.done ? '' : ' skipped'}`} key={setIndex}>
                        <span>{set.warmup ? t('exercise.openGym.warmup') : setNumber}</span>
                        <span className='Health_Exercise_Sets'>{setAmount(t, set)}</span>
                        <span>{set.weightKg ? formatWeight(set.weightKg) : '—'}</span>
                        <span>{effortOf(set)}</span>
                        <span>{set.restSec != null ? formatRest(set.restSec) : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className='Exercise_Item_Details'>{t('exercise.openGym.noSets')}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default Exercise_Workout_Exercises;
