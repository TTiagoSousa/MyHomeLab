import type { BloodOxygenDay } from '../../../../Hooks/Health/healthTypes';
import { formatDay, valueOrDash } from '../Shared/healthFormat';
import Oxygen_Range_Bar from './Oxygen_Range_Bar';
import { belowNormalShare, formatSpo2 } from './oxygenFormat';

interface Oxygen_Day_Row_Props {
  oxygenDay: BloodOxygenDay;
  selected: boolean;
  onSelect: () => void;
}

const Oxygen_Day_Row = ({ oxygenDay, selected, onSelect }: Oxygen_Day_Row_Props) => (
  <button type='button' className={`Health_Table_Row ${selected ? 'selected' : ''}`} onClick={onSelect}>
    <span className='Health_Table_Day'>{formatDay(oxygenDay.day)}</span>
    <span className='Health_Table_Strong'>{formatSpo2(oxygenDay.avgSpo2, 1)}</span>
    <span>{formatSpo2(oxygenDay.nightAvg, 1)}</span>
    <span>{formatSpo2(oxygenDay.minSpo2)}</span>
    <span className='Health_Table_Optional'>{formatSpo2(oxygenDay.maxSpo2)}</span>
    <span className='Health_Table_Optional'>{valueOrDash(belowNormalShare(oxygenDay.ranges), '%')}</span>
    <span className='Health_Table_Optional'>{oxygenDay.samples}</span>
    <span className='Health_Table_Bar'>
      <Oxygen_Range_Bar ranges={oxygenDay.ranges} />
    </span>
  </button>
);

export default Oxygen_Day_Row;
