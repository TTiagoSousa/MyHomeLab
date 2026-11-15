import { useTranslation } from 'react-i18next';
import Health_Split_Bar from '../Shared/Health_Split_Bar';
import { STEP_GOAL } from './stepsFormat';

interface Steps_Goal_Bar_Props {
  steps: number;
}

const Steps_Goal_Bar = ({ steps }: Steps_Goal_Bar_Props) => {
  const { t } = useTranslation('health');
  const done = Math.min(steps, STEP_GOAL);

  return (
    <Health_Split_Bar
      parts={[
        { key: 'done', label: t('steps.series.steps'), value: done, className: steps >= STEP_GOAL ? 'steps-goal' : 'steps-active' },
        { key: 'left', label: t('steps.series.left'), value: STEP_GOAL - done, className: 'steps-left' },
      ]}
    />
  );
};

export default Steps_Goal_Bar;
