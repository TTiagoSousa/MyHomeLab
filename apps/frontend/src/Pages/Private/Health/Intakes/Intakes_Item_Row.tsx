import { useTranslation } from 'react-i18next';
import type { IntakeItem } from '../../../../Hooks/Health/intakesTypes';
import { kindClass, valuesLabel } from './intakesFormat';

interface Intakes_Item_Row_Props {
  item: IntakeItem;
  confirming: boolean;
  onEdit: () => void;
  onRemove: (id: string) => void;
  onCancelRemove: () => void;
}

const Intakes_Item_Row = ({ item, confirming, onEdit, onRemove, onCancelRemove }: Intakes_Item_Row_Props) => {
  const { t } = useTranslation('health');
  const dose = valuesLabel(item.kind, item);

  return (
    <div className={`Intakes_Entry ${kindClass(item.kind)}`}>
      <div className='Diary_Entry_Head'>
        <span className='Diary_Kind'>{item.name}</span>
        <span className='Intakes_Entry_Kind'>{t(`intakes.kinds.${item.kind}`)}</span>
        {dose && <span className='Intakes_Entry_Values'>{t('intakes.items.perDose', { value: dose })}</span>}
        <span className='Diary_Entry_Actions'>
          <button type='button' className='Health_see_all' onClick={onEdit}>
            {t('intakes.edit')}
          </button>
          <button
            type='button'
            className={`Health_see_all danger${confirming ? ' confirm' : ''}`}
            onClick={() => onRemove(item.id)}
            onBlur={onCancelRemove}
          >
            {confirming ? t('intakes.confirmRemove') : t('intakes.remove')}
          </button>
        </span>
      </div>
    </div>
  );
};

export default Intakes_Item_Row;
