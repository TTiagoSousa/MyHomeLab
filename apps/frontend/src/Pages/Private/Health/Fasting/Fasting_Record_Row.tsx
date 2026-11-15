import { useTranslation } from 'react-i18next';
import type { Fast } from '../../../../Hooks/Health/healthLogTypes';
import { fastReached, formatHours, formatMoment } from './fastingFormat';

interface Fasting_Record_Row_Props {
  fast: Fast;
  confirming: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onCancelRemove: () => void;
}

const Fasting_Record_Row = ({ fast, confirming, onEdit, onRemove, onCancelRemove }: Fasting_Record_Row_Props) => {
  const { t } = useTranslation('health');
  const reached = fastReached(fast);

  return (
    <div className='Fasting_Record'>
      <span className='Fasting_Record_Start'>{formatMoment(new Date(fast.startAt))}</span>
      <span className='Fasting_Record_Hours'>{fast.endAt ? formatHours(fast.hours) : t('fasting.records.ongoing')}</span>
      <span className='Fasting_Record_Target'>{t('fasting.targetOf', { value: fast.targetHours })}</span>
      <span className={`Fasting_Record_Reached${reached ? ' reached' : ''}`}>
        {fast.endAt ? (reached ? `✓ ${t('fasting.records.goalReached')}` : t('fasting.records.goalMissed')) : '—'}
      </span>
      <span className='Fasting_Record_Actions'>
        <button type='button' className='Health_see_all' onClick={onEdit}>
          {t('fasting.edit')}
        </button>
        <button
          type='button'
          className={`Health_see_all danger${confirming ? ' confirm' : ''}`}
          onClick={onRemove}
          onBlur={onCancelRemove}
        >
          {confirming ? t('fasting.confirmRemove') : t('fasting.remove')}
        </button>
      </span>
      {fast.notes && <p className='Fasting_Record_Notes'>{fast.notes}</p>}
    </div>
  );
};

export default Fasting_Record_Row;
