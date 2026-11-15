import { useTranslation } from 'react-i18next';
import type { HeartDay } from '../../../../Hooks/Health/healthTypes';
import Health_Table_Head from '../Shared/Health_Table_Head';
import Heart_Day_Row from './Heart_Day_Row';
import { heartColumns } from './heartFormat';

interface Heart_Days_Panel_Props {
  heartDays: HeartDay[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSeeAll: () => void;
}

const Heart_Days_Panel = ({ heartDays, selectedId, onSelect, onSeeAll }: Heart_Days_Panel_Props) => {
  const { t } = useTranslation('health');

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('heart.days', { count: heartDays.length })}</span>
          <p className='Health_card_description'>{t('heart.daysDescription')}</p>
        </div>
        <button type='button' className='Health_see_all' onClick={onSeeAll}>
          {t('heart.seeAll')}
        </button>
      </div>

      <div className='Health_Table heart'>
        <Health_Table_Head columns={heartColumns(t)} />
        <div className='Health_Table_Body'>
          {heartDays.map((heartDay) => (
            <Heart_Day_Row
              key={heartDay.id}
              heartDay={heartDay}
              selected={heartDay.id === selectedId}
              onSelect={() => onSelect(heartDay.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Heart_Days_Panel;
