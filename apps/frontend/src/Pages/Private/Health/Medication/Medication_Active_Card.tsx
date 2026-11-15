import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Medication } from '../../../../Hooks/Health/healthTypes';
import { formatAgo, formatDose, formatFrequency, formatFullDate, medicationDetail } from './medicationFormat';

interface Medication_Active_Card_Props {
  medication: Medication;
  saving: boolean;
  onEdit: () => void;
  onStop: () => void;
  onRemove: () => void;
}

const Medication_Active_Card = ({ medication, saving, onEdit, onStop, onRemove }: Medication_Active_Card_Props) => {
  const { t } = useTranslation('health');
  const [confirm, setConfirm] = useState<'stop' | 'remove' | null>(null);
  const detail = medicationDetail(medication);

  const handleStop = () => {
    if (confirm !== 'stop') {
      setConfirm('stop');
      return;
    }
    setConfirm(null);
    onStop();
  };

  const handleRemove = () => {
    if (confirm !== 'remove') {
      setConfirm('remove');
      return;
    }
    setConfirm(null);
    onRemove();
  };

  return (
    <article className={`Medication_Active ${medication.kind.toLowerCase()}`}>
      <div className='Medication_Active_Head'>
        <span className='Medication_Active_Name'>{medication.name}</span>
        <span className='Medication_Active_Dose'>{formatDose(t, medication)}</span>
      </div>
      <div className='Medication_Active_Kind'>
        <em className={`Medication_Kind ${medication.kind.toLowerCase()}`}>{t(`medication.kinds.${medication.kind}`)}</em>
        {detail && <span>{detail}</span>}
      </div>

      <p className='Medication_Active_Since'>
        {medication.startDate ? (
          <>
            {t('medicationStatus.since', { date: formatFullDate(medication.startDate) })}
            <em>{formatAgo(medication.startDate)}</em>
          </>
        ) : (
          t('medicationStatus.noStart')
        )}
        {medication.endDate && <small>{t('medicationStatus.endsOn', { date: formatFullDate(medication.endDate) })}</small>}
      </p>

      <span className='Medication_Active_Frequency'>{formatFrequency(t, medication)}</span>
      {medication.condition && (
        <span className='Medication_For'>{t('medicationStatus.forCondition', { name: medication.condition.name })}</span>
      )}
      {medication.notes && <small className='Medication_Notes'>{medication.notes}</small>}

      <div className='Medication_Active_Actions'>
        <button
          type='button'
          className={`Health_see_all${confirm === 'stop' ? ' confirm' : ''}`}
          disabled={saving}
          onClick={handleStop}
          onBlur={() => setConfirm(null)}
        >
          {confirm === 'stop' ? t('medicationStatus.confirmStop') : t('medicationStatus.stop')}
        </button>
        <button type='button' className='Health_see_all' onClick={onEdit}>
          {t('medication.edit')}
        </button>
        <button
          type='button'
          className={`Health_see_all danger${confirm === 'remove' ? ' confirm' : ''}`}
          onClick={handleRemove}
          onBlur={() => setConfirm(null)}
        >
          {confirm === 'remove' ? t('medication.confirmRemove') : t('medication.remove')}
        </button>
      </div>
    </article>
  );
};

export default Medication_Active_Card;
