import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HealthCondition } from '../../../../Hooks/Health/healthTypes';
import { formatFullDate } from '../Medication/medicationFormat';

interface Profile_Condition_Row_Props {
  condition: HealthCondition;
  onEdit: () => void;
  onRemove: () => void;
}

const Profile_Condition_Row = ({ condition, onEdit, onRemove }: Profile_Condition_Row_Props) => {
  const { t } = useTranslation('health');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const dates = [
    condition.since ? t('conditions.since', { date: formatFullDate(condition.since) }) : null,
    condition.resolvedAt ? t('conditions.resolvedOn', { date: formatFullDate(condition.resolvedAt) }) : null,
  ].filter(Boolean);

  const handleRemove = () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setConfirmRemove(false);
    onRemove();
  };

  return (
    <article className={`Profile_Condition status-${condition.status.toLowerCase()}`}>
      <div className='Profile_Condition_Head'>
        <span className='Profile_Condition_Name'>{condition.name}</span>
        <span className='Profile_Condition_Status'>{t(`conditions.statuses.${condition.status}`)}</span>
        {condition.severity && (
          <span className='Profile_Condition_Severity'>{t(`conditions.severities.${condition.severity}`)}</span>
        )}
        <span className='Profile_Condition_Actions'>
          <button type='button' className='Health_see_all' onClick={onEdit}>
            {t('conditions.edit')}
          </button>
          <button
            type='button'
            className={`Health_see_all danger${confirmRemove ? ' confirm' : ''}`}
            onClick={handleRemove}
            onBlur={() => setConfirmRemove(false)}
          >
            {confirmRemove ? t('conditions.confirmRemove') : t('conditions.remove')}
          </button>
        </span>
      </div>

      {dates.length > 0 && <span className='Profile_Condition_Dates'>{dates.join(' · ')}</span>}

      {(condition.reaction || condition.treatment || condition.medications.length > 0) && (
        <dl className='Profile_Condition_Facts'>
          {condition.reaction && (
            <div>
              <dt>{t('conditions.reaction')}</dt>
              <dd>{condition.reaction}</dd>
            </div>
          )}
          {condition.treatment && (
            <div>
              <dt>{t('conditions.treatment')}</dt>
              <dd>{condition.treatment}</dd>
            </div>
          )}
          {condition.medications.length > 0 && (
            <div>
              <dt>{t('conditions.medications')}</dt>
              <dd>
                {condition.medications
                  .map((medication) =>
                    medication.active ? medication.name : `${medication.name} (${t('conditions.stoppedMedication')})`,
                  )
                  .join(', ')}
              </dd>
            </div>
          )}
        </dl>
      )}

      {condition.notes && <p className='Health_Notes'>{condition.notes}</p>}
    </article>
  );
};

export default Profile_Condition_Row;
