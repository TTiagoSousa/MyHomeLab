import { useTranslation } from 'react-i18next';
import type { SleepSession } from '../../../../Hooks/Health/healthTypes';
import Health_Table_Head from '../Shared/Health_Table_Head';
import Sleep_Night_Row from './Sleep_Night_Row';
import { sleepColumns } from './sleepFormat';

interface Sleep_Nights_Panel_Props {
  sessions: SleepSession[];
  selectedId: string | null;
  showNaps: boolean;
  onShowNaps: (value: boolean) => void;
  onSelect: (id: string) => void;
  onSeeAll: () => void;
}

const Sleep_Nights_Panel = ({ sessions, selectedId, showNaps, onShowNaps, onSelect, onSeeAll }: Sleep_Nights_Panel_Props) => {
  const { t } = useTranslation('health');

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('sleep.nights', { count: sessions.length })}</span>
          <p className='Health_card_description'>{t('sleep.nightsDescription')}</p>
        </div>
        <div className='Health_card_actions'>
          <label className='Health_toggle'>
            <input type='checkbox' checked={showNaps} onChange={(e) => onShowNaps(e.target.checked)} />
            {t('sleep.showNaps')}
          </label>
          <button type='button' className='Health_see_all' onClick={onSeeAll}>
            {t('sleep.seeAll')}
          </button>
        </div>
      </div>

      <div className='Health_Table sleep'>
        <Health_Table_Head columns={sleepColumns(t)} />
        <div className='Health_Table_Body'>
          {sessions.map((session) => (
            <Sleep_Night_Row
              key={session.id}
              session={session}
              selected={session.id === selectedId}
              onSelect={() => onSelect(session.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Sleep_Nights_Panel;
