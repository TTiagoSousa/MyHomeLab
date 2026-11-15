import { useTranslation } from 'react-i18next';
import type { BloodOxygenDay } from '../../../../Hooks/Health/healthTypes';
import Health_Table_Head from '../Shared/Health_Table_Head';
import Oxygen_Day_Row from './Oxygen_Day_Row';
import { oxygenColumns } from './oxygenFormat';

interface Oxygen_Days_Panel_Props {
  oxygenDays: BloodOxygenDay[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSeeAll: () => void;
}

const Oxygen_Days_Panel = ({ oxygenDays, selectedId, onSelect, onSeeAll }: Oxygen_Days_Panel_Props) => {
  const { t } = useTranslation('health');

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('oxygen.days', { count: oxygenDays.length })}</span>
          <p className='Health_card_description'>{t('oxygen.daysDescription')}</p>
        </div>
        <button type='button' className='Health_see_all' onClick={onSeeAll}>
          {t('oxygen.seeAll')}
        </button>
      </div>

      <div className='Health_Table oxygen'>
        <Health_Table_Head columns={oxygenColumns(t)} />
        <div className='Health_Table_Body'>
          {oxygenDays.map((oxygenDay) => (
            <Oxygen_Day_Row
              key={oxygenDay.id}
              oxygenDay={oxygenDay}
              selected={oxygenDay.id === selectedId}
              onSelect={() => onSelect(oxygenDay.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Oxygen_Days_Panel;
