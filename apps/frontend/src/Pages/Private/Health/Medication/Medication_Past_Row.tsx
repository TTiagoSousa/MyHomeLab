import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Medication } from '../../../../Hooks/Health/healthTypes';
import { formatDose, formatFrequency, formatFullDate, medicationDetail, takenDays } from './medicationFormat';

interface Medication_Past_Row_Props {
  medication: Medication;
  onEdit: () => void;
  onRemove: () => void;
}

const Medication_Past_Row = ({ medication, onEdit, onRemove }: Medication_Past_Row_Props) => {
  const { t } = useTranslation('health');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const endDate = medication.endDate ?? '';

  const handleRemove = () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setConfirmRemove(false);
    onRemove();
  };

  return (
    <div className='Health_Table_Row static'>
      <span className='Health_Table_Strong'>
        {medication.name}
        <small className='Medication_Past_Detail'>
          {[t(`medication.kinds.${medication.kind}`), medicationDetail(medication)].filter(Boolean).join(' · ')}
        </small>
        {medication.condition && (
          <small className='Medication_For'>{t('medicationStatus.forCondition', { name: medication.condition.name })}</small>
        )}
      </span>
      <span>{formatDose(t, medication)}</span>
      <span className='Health_Table_Optional'>{formatFrequency(t, medication)}</span>
      <span className='Medication_Past_Range'>
        {medication.startDate
          ? `${t('medicationStatus.tookRange', {
              from: formatFullDate(medication.startDate),
              to: formatFullDate(endDate),
            })} ${t('medicationStatus.tookDays', { count: takenDays(medication.startDate, endDate) })}`
          : t('medicationStatus.tookUntil', { date: formatFullDate(endDate) })}
      </span>
      <span className='Health_Table_Actions'>
        <button type='button' className='Health_see_all' onClick={onEdit}>
          {t('medication.edit')}
        </button>
        <button
          type='button'
          className={`Health_see_all danger${confirmRemove ? ' confirm' : ''}`}
          onClick={handleRemove}
          onBlur={() => setConfirmRemove(false)}
        >
          {confirmRemove ? t('medication.confirmRemove') : t('medication.remove')}
        </button>
      </span>
      {medication.notes && <small className='Medication_Notes'>{medication.notes}</small>}
    </div>
  );
};

export default Medication_Past_Row;
