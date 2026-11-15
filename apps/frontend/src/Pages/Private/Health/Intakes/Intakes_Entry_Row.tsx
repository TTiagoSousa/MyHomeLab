import { useTranslation } from 'react-i18next';
import type { IntakeEntry } from '../../../../Hooks/Health/intakesTypes';
import { localClock } from '../Shared/healthFormat';
import { formatDrinks, formatNumber, intakeName, kindClass, valuesLabel } from './intakesFormat';

interface Intakes_Entry_Row_Props {
  entry: IntakeEntry;
  confirming: boolean;
  onEdit: () => void;
  onRemove: (id: string) => void;
  onCancelRemove: () => void;
}

const Intakes_Entry_Row = ({ entry, confirming, onEdit, onRemove, onCancelRemove }: Intakes_Entry_Row_Props) => {
  const { t } = useTranslation('health');
  const values = valuesLabel(entry.kind, entry);
  const details = [
    values || null,
    entry.drinks != null && entry.drinks > 0 ? formatDrinks(t, entry.drinks) : null,
  ].filter(Boolean);

  return (
    <div className={`Intakes_Entry ${kindClass(entry.kind)}`}>
      <em className='Intakes_Entry_Time'>{localClock(entry.at, entry.timeZone)}</em>
      <span className='Intakes_Entry_Name' title={t(`intakes.kinds.${entry.kind}`)}>
        {entry.quantity !== 1 && <b>{formatNumber(entry.quantity, 2)}×</b>}
        {intakeName(t, entry.presetId, entry.name)}
      </span>
      <span className='Intakes_Entry_Values'>{details.join(' · ')}</span>
      <span className='Intakes_Entry_Actions'>
        <button type='button' className='Health_see_all' onClick={onEdit}>
          {t('intakes.edit')}
        </button>
        <button
          type='button'
          className={`Health_see_all danger${confirming ? ' confirm' : ''}`}
          onClick={() => onRemove(entry.id)}
          onBlur={onCancelRemove}
        >
          {confirming ? t('intakes.confirmRemove') : t('intakes.remove')}
        </button>
      </span>
      {entry.notes && <p className='Intakes_Entry_Notes'>{entry.notes}</p>}
    </div>
  );
};

export default Intakes_Entry_Row;
