import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Condition_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import type {
  ConditionKind,
  ConditionSeverity,
  ConditionStatus,
  HealthCondition,
  HealthConditionPayload,
} from '../../../Hooks/Health/healthTypes';
import { CONDITION_SEVERITIES, CONDITION_STATUSES } from '../../../Pages/Private/Health/Profile/conditionFormat';

interface Condition_Modal_Props {
  kind: ConditionKind;
  existing: HealthCondition | null;
  saving: boolean;
  onSave: (payload: HealthConditionPayload) => Promise<string | null>;
  onClose: () => void;
}

const Condition_Modal = ({ kind, existing, saving, onSave, onClose }: Condition_Modal_Props) => {
  const { t } = useTranslation('health');
  const isAllergy = kind === 'ALLERGY';
  const [name, setName] = useState(existing?.name ?? '');
  const [status, setStatus] = useState<ConditionStatus>(existing?.status ?? 'ACTIVE');
  const [severity, setSeverity] = useState<ConditionSeverity | null>(existing?.severity ?? null);
  const [since, setSince] = useState(existing?.since ?? '');
  const [resolvedAt, setResolvedAt] = useState(existing?.resolvedAt ?? '');
  const [reaction, setReaction] = useState(existing?.reaction ?? '');
  const [treatment, setTreatment] = useState(existing?.treatment ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState('');

  const datesValid = !since || !resolvedAt || status !== 'RESOLVED' || resolvedAt >= since;
  const canSave = !saving && name.trim().length > 0 && datesValid;

  const handleSave = async () => {
    if (!canSave) return;
    const failure = await onSave({
      kind,
      name: name.trim(),
      status,
      severity,
      since: since || null,
      resolvedAt: status === 'RESOLVED' ? resolvedAt || null : null,
      reaction: isAllergy ? reaction.trim() || null : null,
      treatment: treatment.trim() || null,
      notes: notes.trim() || null,
    });
    if (failure) setError(failure);
    else onClose();
  };

  return (
    <div className='Condition_Modal_Overlay' onClick={() => !saving && onClose()}>
      <div className='Condition_Modal' role='dialog' aria-modal='true' onClick={(e) => e.stopPropagation()}>
        <div className='Condition_Modal_Head'>
          <span className='Condition_Modal_Title'>
            {existing
              ? t('conditions.modal.editTitle', { name: existing.name })
              : t(isAllergy ? 'conditions.modal.addAllergyTitle' : 'conditions.modal.addConditionTitle')}
          </span>
          <span className='Condition_Modal_Subtitle'>{t('conditions.modal.subtitle')}</span>
        </div>

        <div className='Condition_Modal_Field'>
          <label htmlFor='condition-name'>{t('conditions.modal.name')}</label>
          <Global_Input
            id='condition-name'
            value={name}
            maxLength={120}
            placeholder={t(isAllergy ? 'conditions.modal.allergyPlaceholder' : 'conditions.modal.conditionPlaceholder')}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className='Condition_Modal_Field'>
          <span className='Condition_Modal_Label'>{t('conditions.modal.status')}</span>
          <div className='Condition_Modal_Options' role='radiogroup' aria-label={t('conditions.modal.status')}>
            {CONDITION_STATUSES.map((option) => (
              <button
                key={option}
                type='button'
                role='radio'
                aria-checked={status === option}
                className={`status-${option.toLowerCase()}${status === option ? ' active' : ''}`}
                onClick={() => setStatus(option)}
              >
                {t(`conditions.statuses.${option}`)}
              </button>
            ))}
          </div>
        </div>

        <div className='Condition_Modal_Field'>
          <span className='Condition_Modal_Label'>{t('conditions.modal.severity')}</span>
          <div className='Condition_Modal_Options' role='radiogroup' aria-label={t('conditions.modal.severity')}>
            <button
              type='button'
              role='radio'
              aria-checked={severity === null}
              className={severity === null ? 'active' : ''}
              onClick={() => setSeverity(null)}
            >
              {t('conditions.modal.noSeverity')}
            </button>
            {CONDITION_SEVERITIES.map((option) => (
              <button
                key={option}
                type='button'
                role='radio'
                aria-checked={severity === option}
                className={severity === option ? 'active' : ''}
                onClick={() => setSeverity(option)}
              >
                {t(`conditions.severities.${option}`)}
              </button>
            ))}
          </div>
        </div>

        <div className='Condition_Modal_Row'>
          <div className='Condition_Modal_Field'>
            <label htmlFor='condition-since'>{t('conditions.modal.since')}</label>
            <Global_Input id='condition-since' type='date' value={since} onChange={(e) => setSince(e.target.value)} />
          </div>
          {status === 'RESOLVED' && (
            <div className='Condition_Modal_Field'>
              <label htmlFor='condition-resolved'>{t('conditions.modal.resolvedAt')}</label>
              <Global_Input
                id='condition-resolved'
                type='date'
                value={resolvedAt}
                min={since || undefined}
                onChange={(e) => setResolvedAt(e.target.value)}
              />
            </div>
          )}
        </div>

        {isAllergy && (
          <div className='Condition_Modal_Field'>
            <label htmlFor='condition-reaction'>{t('conditions.modal.reaction')}</label>
            <Global_Input
              id='condition-reaction'
              value={reaction}
              maxLength={500}
              placeholder={t('conditions.modal.reactionPlaceholder')}
              onChange={(e) => setReaction(e.target.value)}
            />
          </div>
        )}

        <div className='Condition_Modal_Field'>
          <label htmlFor='condition-treatment'>{t('conditions.modal.treatment')}</label>
          <textarea
            id='condition-treatment'
            rows={2}
            maxLength={1000}
            value={treatment}
            placeholder={t(isAllergy ? 'conditions.modal.allergyTreatmentPlaceholder' : 'conditions.modal.treatmentPlaceholder')}
            onChange={(e) => setTreatment(e.target.value)}
          />
        </div>

        <div className='Condition_Modal_Field'>
          <label htmlFor='condition-notes'>{t('conditions.modal.notes')}</label>
          <textarea id='condition-notes' rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {!datesValid && <p className='Condition_Modal_Error'>{t('conditions.modal.datesInvalid')}</p>}
        {error && <p className='Condition_Modal_Error'>{error}</p>}

        <div className='Condition_Modal_Actions'>
          <button type='button' className='Cancel_Button' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </button>
          <button type='button' className='Save_Button' onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? t('conditions.modal.saving') : t('conditions.modal.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Condition_Modal;
