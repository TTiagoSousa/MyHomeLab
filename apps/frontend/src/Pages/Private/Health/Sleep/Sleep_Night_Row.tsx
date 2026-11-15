import { useTranslation } from 'react-i18next';
import type { SleepSession } from '../../../../Hooks/Health/healthTypes';
import { formatDay, formatDuration, localClock } from '../Shared/healthFormat';
import Sleep_Stage_Bar from './Sleep_Stage_Bar';

interface Sleep_Night_Row_Props {
  session: SleepSession;
  selected: boolean;
  onSelect: () => void;
}

const Sleep_Night_Row = ({ session, selected, onSelect }: Sleep_Night_Row_Props) => {
  const { t } = useTranslation('health');
  const stage = (minutes: number) => (session.isNap ? '—' : formatDuration(minutes));

  return (
    <button type='button' className={`Health_Table_Row ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <span className='Health_Table_Day'>
        {formatDay(session.night)}
        {session.isNap && <em>{t('stages.NAP')}</em>}
      </span>
      <span>{localClock(session.asleepAt, session.timeZone)}</span>
      <span>{localClock(session.wakeAt, session.timeZone)}</span>
      <span className='Health_Table_Strong'>{formatDuration(session.asleepMin)}</span>
      <span className='Health_Table_Optional'>{stage(session.deepMin)}</span>
      <span className='Health_Table_Optional'>{stage(session.lightMin)}</span>
      <span className='Health_Table_Optional'>{stage(session.remMin)}</span>
      <span className='Health_Table_Optional'>{stage(session.awakeMin)}</span>
      <span className='Health_Table_Bar'>
        {session.isNap ? (
          <Sleep_Stage_Bar parts={[{ stage: 'NAP', value: session.asleepMin }]} />
        ) : (
          <Sleep_Stage_Bar
            parts={[
              { stage: 'DEEP', value: session.deepMin },
              { stage: 'LIGHT', value: session.lightMin },
              { stage: 'REM', value: session.remMin },
              { stage: 'AWAKE', value: session.awakeMin },
            ]}
          />
        )}
      </span>
    </button>
  );
};

export default Sleep_Night_Row;
