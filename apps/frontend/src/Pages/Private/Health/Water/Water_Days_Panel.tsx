import { useTranslation } from 'react-i18next';
import type { WaterDay } from '../../../../Hooks/Health/healthTypes';
import Health_Table_Head from '../Shared/Health_Table_Head';
import { formatDay } from '../Shared/healthFormat';
import Water_Goal_Bar from './Water_Goal_Bar';
import { formatMl, goalShare } from './waterFormat';

interface Water_Days_Panel_Props {
  waterDays: WaterDay[];
  goal: number;
}

const Water_Days_Panel = ({ waterDays, goal }: Water_Days_Panel_Props) => {
  const { t } = useTranslation('health');

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('water.days', { count: waterDays.length })}</span>
          <p className='Health_card_description'>{t('water.daysDescription')}</p>
        </div>
      </div>

      <div className='Health_Table water'>
        <Health_Table_Head
          columns={[
            { key: 'date', label: t('water.columns.date') },
            { key: 'total', label: t('water.columns.total') },
            { key: 'goal', label: t('water.columns.goal') },
            { key: 'entries', label: t('water.columns.entries'), optional: true },
            { key: 'bar', label: t('water.columns.bar') },
          ]}
        />
        <div className='Health_Table_Body'>
          {waterDays.map((day) => (
            <div key={day.day} className='Health_Table_Row static'>
              <span className='Health_Table_Day'>{formatDay(day.day)}</span>
              <span className='Health_Table_Strong'>{formatMl(day.ml)}</span>
              <span>{goalShare(day.ml, goal)}%</span>
              <span className='Health_Table_Optional'>{t('water.entriesCount', { count: day.entries.length })}</span>
              <span className='Health_Table_Bar'>
                <Water_Goal_Bar ml={day.ml} goal={goal} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Water_Days_Panel;
