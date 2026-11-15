import { useTranslation } from 'react-i18next';
import type { ActivityDay } from '../../../../Hooks/Health/healthTypes';
import { formatDay, formatDistance, formatDuration, formatSteps } from '../Shared/healthFormat';
import Steps_Goal_Bar from './Steps_Goal_Bar';
import { goalShare } from './stepsFormat';

interface Steps_Day_Row_Props {
  stepsDay: ActivityDay;
  selected: boolean;
  onSelect: () => void;
}

const Steps_Day_Row = ({ stepsDay, selected, onSelect }: Steps_Day_Row_Props) => {
  const { t } = useTranslation('health');
  const pace = stepsDay.activeMinutes ? Math.round(stepsDay.steps / stepsDay.activeMinutes) : null;

  return (
    <button type='button' className={`Health_Table_Row ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <span className='Health_Table_Day'>{formatDay(stepsDay.day)}</span>
      <span className='Health_Table_Strong'>{formatSteps(stepsDay.steps)}</span>
      <span>{goalShare(stepsDay.steps)}%</span>
      <span>{formatDistance(stepsDay.distanceM)}</span>
      <span className='Health_Table_Optional'>{stepsDay.calories} kcal</span>
      <span className='Health_Table_Optional'>{formatDuration(stepsDay.activeMinutes)}</span>
      <span className='Health_Table_Optional'>{pace ? t('steps.metrics.paceShort', { value: pace }) : '—'}</span>
      <span className='Health_Table_Bar'>
        <Steps_Goal_Bar steps={stepsDay.steps} />
      </span>
    </button>
  );
};

export default Steps_Day_Row;
