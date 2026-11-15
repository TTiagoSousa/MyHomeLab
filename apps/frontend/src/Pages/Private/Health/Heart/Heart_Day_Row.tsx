import { useTranslation } from 'react-i18next';
import type { HeartDay } from '../../../../Hooks/Health/healthTypes';
import { formatDay, valueOrDash } from '../Shared/healthFormat';
import Heart_Zone_Bar from './Heart_Zone_Bar';

interface Heart_Day_Row_Props {
  heartDay: HeartDay;
  selected: boolean;
  onSelect: () => void;
}

const Heart_Day_Row = ({ heartDay, selected, onSelect }: Heart_Day_Row_Props) => {
  const { t } = useTranslation('health');
  const bpm = ` ${t('units.bpm')}`;

  return (
    <button type='button' className={`Health_Table_Row ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <span className='Health_Table_Day'>{formatDay(heartDay.day)}</span>
      <span className='Health_Table_Strong'>{valueOrDash(heartDay.restingBpm, bpm)}</span>
      <span>{`${heartDay.avgBpm}${bpm}`}</span>
      <span className='Health_Table_Optional'>{`${heartDay.minBpm}${bpm}`}</span>
      <span className='Health_Table_Optional'>{`${heartDay.maxBpm}${bpm}`}</span>
      <span className='Health_Table_Optional'>{valueOrDash(heartDay.avgHrv, ` ${t('units.ms')}`)}</span>
      <span>{heartDay.samples}</span>
      <span className='Health_Table_Bar'>
        <Heart_Zone_Bar zones={heartDay.zones} />
      </span>
    </button>
  );
};

export default Heart_Day_Row;
