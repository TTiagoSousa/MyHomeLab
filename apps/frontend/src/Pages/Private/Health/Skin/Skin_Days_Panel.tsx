import { useTranslation } from 'react-i18next';
import type { SkinTemperatureDay } from '../../../../Hooks/Health/healthTypes';
import Health_Table_Head from '../Shared/Health_Table_Head';
import Skin_Day_Row from './Skin_Day_Row';
import { skinColumns } from './skinFormat';

interface Skin_Days_Panel_Props {
  temperatureDays: SkinTemperatureDay[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSeeAll: () => void;
}

const Skin_Days_Panel = ({ temperatureDays, selectedId, onSelect, onSeeAll }: Skin_Days_Panel_Props) => {
  const { t } = useTranslation('health');

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('skin.days', { count: temperatureDays.length })}</span>
          <p className='Health_card_description'>{t('skin.daysDescription')}</p>
        </div>
        <button type='button' className='Health_see_all' onClick={onSeeAll}>
          {t('skin.seeAll')}
        </button>
      </div>

      <div className='Health_Table skin'>
        <Health_Table_Head columns={skinColumns(t)} />
        <div className='Health_Table_Body'>
          {temperatureDays.map((temperatureDay) => (
            <Skin_Day_Row
              key={temperatureDay.id}
              temperatureDay={temperatureDay}
              selected={temperatureDay.id === selectedId}
              onSelect={() => onSelect(temperatureDay.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Skin_Days_Panel;
