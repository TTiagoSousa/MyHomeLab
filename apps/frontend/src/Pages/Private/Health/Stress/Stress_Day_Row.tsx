import type { StressDay } from '../../../../Hooks/Health/healthTypes';
import { formatDay, valueOrDash } from '../Shared/healthFormat';
import Stress_Level_Bar from './Stress_Level_Bar';
import { formatScore, levelShare } from './stressFormat';

interface Stress_Day_Row_Props {
  stressDay: StressDay;
  selected: boolean;
  onSelect: () => void;
}

const Stress_Day_Row = ({ stressDay, selected, onSelect }: Stress_Day_Row_Props) => (
  <button type='button' className={`Health_Table_Row ${selected ? 'selected' : ''}`} onClick={onSelect}>
    <span className='Health_Table_Day'>{formatDay(stressDay.day)}</span>
    <span className='Health_Table_Strong'>{formatScore(stressDay.avgScore)}</span>
    <span>{stressDay.minScore}</span>
    <span>{stressDay.maxScore}</span>
    <span className='Health_Table_Optional'>{valueOrDash(levelShare(stressDay.levels, ['relaxed']), '%')}</span>
    <span className='Health_Table_Optional'>{valueOrDash(levelShare(stressDay.levels, ['medium', 'high']), '%')}</span>
    <span className='Health_Table_Optional'>{stressDay.samples}</span>
    <span className='Health_Table_Bar'>
      <Stress_Level_Bar levels={stressDay.levels} />
    </span>
  </button>
);

export default Stress_Day_Row;
