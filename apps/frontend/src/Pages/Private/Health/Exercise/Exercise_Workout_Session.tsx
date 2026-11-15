import { useTranslation } from 'react-i18next';
import type { WorkoutDetail } from '../../../../Hooks/Health/healthTypes';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay, formatDistance, localClock, valueOrDash } from '../Shared/healthFormat';
import { formatWorkoutDuration, typeName } from './exerciseFormat';

interface Exercise_Workout_Session_Props {
  workout: WorkoutDetail;
  onOpen: (id: string) => void;
  onEdit: () => void;
  onDetach: (id: string) => void;
}

const Exercise_Workout_Session = ({ workout, onOpen, onEdit, onDetach }: Exercise_Workout_Session_Props) => {
  const { t } = useTranslation('health');
  const { parent, parts, session } = workout;

  if (parent) {
    return (
      <section className='Health_card Exercise_Session'>
        <div className='Health_card_head'>
          <div>
            <span className='Health_card_title'>{t('sessions.partOfTitle')}</span>
            <p className='Health_card_description'>
              {t('sessions.partOf', {
                role: t(`sessions.roles.${workout.partRole ?? 'PART'}`),
                name: typeName(t, parent.typeId),
                date: `${formatDay(parent.day, false)} · ${localClock(parent.startAt, workout.timeZone)}`,
              })}
            </p>
          </div>
          <div className='Exercise_Session_Actions'>
            <button type='button' className='Health_see_all' onClick={() => onOpen(parent.id)}>
              {t('sessions.openMain')}
            </button>
            <button type='button' className='Health_see_all' onClick={() => onDetach(workout.id)}>
              {t('sessions.detach')}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className='Health_card Exercise_Session'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('sessions.title')}</span>
          <p className='Health_card_description'>{parts.length ? t('sessions.description') : t('sessions.emptyDescription')}</p>
        </div>
        <button type='button' className='Health_see_all' onClick={onEdit}>
          {parts.length ? t('sessions.edit') : t('sessions.join')}
        </button>
      </div>

      {session && (
        <div className='Health_Stats columns-4'>
          <Health_Stat highlight label={t('sessions.totalDuration')} value={formatWorkoutDuration(session.durationSec)} />
          <Health_Stat label={t('sessions.totalDistance')} value={formatDistance(session.distanceM)} />
          <Health_Stat label={t('sessions.totalCalories')} value={valueOrDash(session.calories, ' kcal')} />
          <Health_Stat label={t('exercise.metrics.avgHeart')} value={valueOrDash(session.avgHeartRate, ` ${t('units.bpm')}`)} />
        </div>
      )}

      {parts.length > 0 && (
        <div className='Exercise_Session_Parts_List'>
          {parts.map((part) => (
            <div key={part.id} className='Exercise_Session_Part'>
              <span className='Exercise_Session_Role'>{t(`sessions.roles.${part.partRole ?? 'PART'}`)}</span>
              <span className='Exercise_Session_Name'>{part.title ?? typeName(t, part.typeId)}</span>
              <span className='Exercise_Session_Meta'>
                {localClock(part.startAt, part.timeZone)} · {formatWorkoutDuration(part.durationSec)}
                {part.distanceM ? ` · ${formatDistance(part.distanceM)}` : ''}
              </span>
              <span className='Exercise_Session_Actions'>
                <button type='button' className='Health_see_all' onClick={() => onOpen(part.id)}>
                  {t('sessions.open')}
                </button>
                <button type='button' className='Health_see_all' onClick={() => onDetach(part.id)}>
                  {t('sessions.detach')}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default Exercise_Workout_Session;
