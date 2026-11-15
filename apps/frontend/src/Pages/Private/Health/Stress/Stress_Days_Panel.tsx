import { useTranslation } from 'react-i18next';
import type { StressDay } from '../../../../Hooks/Health/healthTypes';
import Health_Table_Head from '../Shared/Health_Table_Head';
import Stress_Day_Row from './Stress_Day_Row';
import { stressColumns } from './stressFormat';

interface Stress_Days_Panel_Props {
  stressDays: StressDay[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSeeAll: () => void;
}

const Stress_Days_Panel = ({ stressDays, selectedId, onSelect, onSeeAll }: Stress_Days_Panel_Props) => {
  const { t } = useTranslation('health');

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('stress.days', { count: stressDays.length })}</span>
          <p className='Health_card_description'>{t('stress.daysDescription')}</p>
        </div>
        <button type='button' className='Health_see_all' onClick={onSeeAll}>
          {t('stress.seeAll')}
        </button>
      </div>

      <div className='Health_Table stress'>
        <Health_Table_Head columns={stressColumns(t)} />
        <div className='Health_Table_Body'>
          {stressDays.map((stressDay) => (
            <Stress_Day_Row
              key={stressDay.id}
              stressDay={stressDay}
              selected={stressDay.id === selectedId}
              onSelect={() => onSelect(stressDay.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stress_Days_Panel;
