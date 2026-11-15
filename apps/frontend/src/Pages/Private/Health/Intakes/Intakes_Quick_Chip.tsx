import { useTranslation } from 'react-i18next';
import type { IntakeSource } from './Intakes_Entry_Form';
import { valuesLabel } from './intakesFormat';

interface Intakes_Quick_Chip_Props {
  source: IntakeSource;
  className: string;
  saving: boolean;
  onAdd: (source: IntakeSource) => void;
  onOpen: (source: IntakeSource) => void;
}

const Intakes_Quick_Chip = ({ source, className, saving, onAdd, onOpen }: Intakes_Quick_Chip_Props) => {
  const { t } = useTranslation('health');
  const dose = valuesLabel(source.kind, source.dose);

  return (
    <div className={`Intakes_Chip ${className}${source.itemId ? ' own' : ''}`}>
      <button type='button' className='Intakes_Chip_Main' disabled={saving} title={t('intakes.quick.addNow')} onClick={() => onAdd(source)}>
        <b>{source.label}</b>
        {dose && <small>{dose}</small>}
      </button>
      <button
        type='button'
        className='Intakes_Chip_More'
        aria-label={t('intakes.quick.more')}
        title={t('intakes.quick.more')}
        onClick={() => onOpen(source)}
      >
        ⋯
      </button>
    </div>
  );
};

export default Intakes_Quick_Chip;
