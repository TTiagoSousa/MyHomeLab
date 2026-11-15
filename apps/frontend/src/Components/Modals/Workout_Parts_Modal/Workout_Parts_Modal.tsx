import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Workout_Parts_Modal.scss';
import type { Workout, WorkoutDetail, WorkoutPartPayload, WorkoutPartRole } from '../../../Hooks/Health/healthTypes';
import { useWorkoutPartCandidates } from '../../../Hooks/Health/useWorkoutPartCandidates';
import { formatDay, formatDistance, localClock } from '../../../Pages/Private/Health/Shared/healthFormat';
import {
  WORKOUT_PART_ROLES,
  defaultPartRole,
  formatWorkoutDuration,
  typeName,
} from '../../../Pages/Private/Health/Exercise/exerciseFormat';

interface Workout_Parts_Modal_Props {
  workout: WorkoutDetail;
  onSave: (parts: WorkoutPartPayload[]) => Promise<string | null>;
  onClose: () => void;
}

const Workout_Parts_Modal = ({ workout, onSave, onClose }: Workout_Parts_Modal_Props) => {
  const { t } = useTranslation('health');
  const { candidates, loading, error: loadError } = useWorkoutPartCandidates(workout.id);
  const [selected, setSelected] = useState<Record<string, WorkoutPartRole>>(
    Object.fromEntries(workout.parts.map((part) => [part.id, part.partRole ?? 'PART'])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (candidate: Workout) => {
    if (selected[candidate.id]) {
      setSelected(Object.fromEntries(Object.entries(selected).filter(([id]) => id !== candidate.id)));
    } else {
      setSelected({ ...selected, [candidate.id]: defaultPartRole(workout, candidate) });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const failure = await onSave(Object.entries(selected).map(([id, role]) => ({ id, role })));
    setSaving(false);
    if (failure) setError(failure);
    else onClose();
  };

  return (
    <div className='Workout_Parts_Modal_Overlay' onClick={() => !saving && onClose()}>
      <div className='Workout_Parts_Modal' role='dialog' aria-modal='true' onClick={(e) => e.stopPropagation()}>
        <div className='Workout_Parts_Modal_Head'>
          <span className='Workout_Parts_Modal_Title'>{t('sessions.modal.title', { name: typeName(t, workout.typeId) })}</span>
          <span className='Workout_Parts_Modal_Subtitle'>{t('sessions.modal.subtitle')}</span>
        </div>

        {loading && <span className='Workout_Parts_Modal_Muted'>{t('loading')}</span>}
        {loadError && <p className='Workout_Parts_Modal_Error'>{loadError}</p>}
        {!loading && !loadError && !candidates.length && (
          <span className='Workout_Parts_Modal_Muted'>{t('sessions.modal.empty')}</span>
        )}

        <div className='Workout_Parts_Modal_List'>
          {candidates.map((candidate) => {
            const role = selected[candidate.id];
            const elsewhere = candidate.parentId && candidate.parentId !== workout.id;
            return (
              <div key={candidate.id} className={`Workout_Parts_Modal_Item${role ? ' selected' : ''}`}>
                <label className='Workout_Parts_Modal_Check'>
                  <input type='checkbox' checked={Boolean(role)} onChange={() => toggle(candidate)} />
                  <span className='Workout_Parts_Modal_Name'>{candidate.title ?? typeName(t, candidate.typeId)}</span>
                  <span className='Workout_Parts_Modal_Meta'>
                    {candidate.day !== workout.day ? `${formatDay(candidate.day, false)} · ` : ''}
                    {localClock(candidate.startAt, candidate.timeZone)}–{localClock(candidate.endAt, candidate.timeZone)}
                    {' · '}
                    {formatWorkoutDuration(candidate.durationSec)}
                    {candidate.distanceM ? ` · ${formatDistance(candidate.distanceM)}` : ''}
                  </span>
                  {elsewhere && <small className='Workout_Parts_Modal_Muted'>{t('sessions.modal.elsewhere')}</small>}
                </label>
                {role && (
                  <div className='Workout_Parts_Modal_Roles' role='radiogroup' aria-label={t('sessions.modal.role')}>
                    {WORKOUT_PART_ROLES.map((option) => (
                      <button
                        key={option}
                        type='button'
                        role='radio'
                        aria-checked={role === option}
                        className={role === option ? 'active' : ''}
                        onClick={() => setSelected({ ...selected, [candidate.id]: option })}
                      >
                        {t(`sessions.roles.${option}`)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className='Workout_Parts_Modal_Error'>{error}</p>}

        <div className='Workout_Parts_Modal_Actions'>
          <button type='button' className='Cancel_Button' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </button>
          <button type='button' className='Save_Button' onClick={() => void handleSave()} disabled={saving || loading}>
            {saving ? t('sessions.modal.saving') : t('sessions.modal.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Workout_Parts_Modal;
