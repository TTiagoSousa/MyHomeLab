import { useTranslation } from 'react-i18next';
import type { ActivityDay } from '../../../../Hooks/Health/healthTypes';
import Health_Table_Head from '../Shared/Health_Table_Head';
import Steps_Day_Row from './Steps_Day_Row';
import { stepsColumns } from './stepsFormat';

interface Steps_Days_Panel_Props {
  stepsDays: ActivityDay[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSeeAll: () => void;
}

const Steps_Days_Panel = ({ stepsDays, selectedId, onSelect, onSeeAll }: Steps_Days_Panel_Props) => {
  const { t } = useTranslation('health');

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('steps.days', { count: stepsDays.length })}</span>
          <p className='Health_card_description'>{t('steps.daysDescription')}</p>
        </div>
        <button type='button' className='Health_see_all' onClick={onSeeAll}>
          {t('steps.seeAll')}
        </button>
      </div>

      <div className='Health_Table steps'>
        <Health_Table_Head columns={stepsColumns(t)} />
        <div className='Health_Table_Body'>
          {stepsDays.map((stepsDay) => (
            <Steps_Day_Row
              key={stepsDay.id}
              stepsDay={stepsDay}
              selected={stepsDay.id === selectedId}
              onSelect={() => onSelect(stepsDay.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Steps_Days_Panel;
