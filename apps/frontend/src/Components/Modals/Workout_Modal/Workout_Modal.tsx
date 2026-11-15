import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Workout_Modal.scss';
import Global_Dropdown from '../../Inputs/Global_Dropdown/Global_Dropdown';
import Workout_Session_Fields from '../../Health/Workout_Form/Workout_Session_Fields';
import Workout_Sync_Result from '../../Health/Workout_Form/Workout_Sync_Result';
import {
  hasSessionLength,
  sessionFromDates,
  sessionPayload,
  validSession,
  type SessionForm,
} from '../../Health/Workout_Form/workoutForm';
import { useExerciseTypes } from '../../../Hooks/Health/useExerciseTypes';
import { useManualWorkout } from '../../../Hooks/Health/useManualWorkout';
import type { WorkoutDetail, WorkoutSync } from '../../../Hooks/Health/healthTypes';

interface Workout_Modal_Props {
  existing: WorkoutDetail | null;
  onSaved: () => void;
  onClose: () => void;
}

const DEFAULT_TYPE = 'walking';

const initialSession = (existing: WorkoutDetail | null): SessionForm => {
  if (!existing) return sessionFromDates(new Date(), null);
  const session = sessionFromDates(new Date(existing.startAt), existing.durationSec > 0 ? new Date(existing.endAt) : null);
  return {
    ...session,
    calories: existing.calories != null && !existing.caloriesEstimated ? String(existing.calories) : '',
    difficulty: existing.difficulty ?? null,
    notes: existing.notes ?? '',
  };
};

const Workout_Modal = ({ existing, onSaved, onClose }: Workout_Modal_Props) => {
  const { t } = useTranslation('health');
  const { sports } = useExerciseTypes();
  const { saving, saveWorkout } = useManualWorkout();
  const [typeId, setTypeId] = useState(existing?.typeId ?? DEFAULT_TYPE);
  const [session, setSession] = useState<SessionForm>(() => initialSession(existing));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ sync: WorkoutSync | null } | null>(null);

  const canSave = !saving && Boolean(typeId) && validSession(session) && hasSessionLength(session);

  const handleSave = async () => {
    if (!canSave) return;
    setError('');
    const result = await saveWorkout({ ...sessionPayload(session), typeId }, existing?.id);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved({ sync: result.sync });
  };

  const close = () => {
    if (saving) return;
    if (saved) onSaved();
    else onClose();
  };

  return (
    <div className='Workout_Modal_Overlay' onClick={close}>
      <div className='Workout_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Workout_Modal_Head'>
          <span className='Workout_Modal_Title'>{existing ? t('exercise.manual.editTitle') : t('exercise.manual.title')}</span>
          <span className='Workout_Modal_Subtitle'>{t('workoutForm.subtitle')}</span>
        </div>

        {saved ? (
          <Workout_Sync_Result sync={saved.sync} onClose={onSaved} />
        ) : (
          <>
            <div className='Workout_Form_Field'>
              <label htmlFor='workout-type'>{t('exercise.manual.type')}</label>
              <Global_Dropdown
                id='workout-type'
                value={typeId}
                onChange={setTypeId}
                searchable
                maxVisibleOptions={7}
                options={sports.map((sport) => ({ value: sport.id, label: t(`exercise.types.${sport.id}`) }))}
              />
            </div>

            <Workout_Session_Fields
              idPrefix='workout'
              form={session}
              onChange={(change) => {
                setSession({ ...session, ...change });
                setError('');
              }}
            />

            <div className='Workout_Form_Field'>
              <label htmlFor='workout-notes'>{t('exercise.manual.notes')}</label>
              <textarea
                id='workout-notes'
                rows={3}
                maxLength={1000}
                value={session.notes}
                placeholder={t('exercise.manual.notesPlaceholder')}
                onChange={(e) => setSession({ ...session, notes: e.target.value })}
              />
            </div>

            <p className='Workout_Modal_Hint'>{t('workoutForm.openGymHint')}</p>

            {error && <p className='Workout_Modal_Error'>{error}</p>}

            <div className='Workout_Modal_Actions'>
              <button type='button' className='Cancel_Button' onClick={onClose} disabled={saving}>
                {t('common:actions.cancel')}
              </button>
              <button type='button' className='Save_Button' onClick={() => void handleSave()} disabled={!canSave}>
                {saving ? t('exercise.manual.saving') : t('exercise.manual.save')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Workout_Modal;
