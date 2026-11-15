import { useTranslation } from 'react-i18next';
import Health_Split_Bar from '../Shared/Health_Split_Bar';

interface Water_Goal_Bar_Props {
  ml: number;
  goal: number;
}

const Water_Goal_Bar = ({ ml, goal }: Water_Goal_Bar_Props) => {
  const { t } = useTranslation('health');
  const done = Math.min(ml, goal);

  return (
    <Health_Split_Bar
      parts={[
        { key: 'done', label: t('water.series.water'), value: done, className: ml >= goal ? 'water-goal' : 'water-done' },
        { key: 'left', label: t('water.series.goal'), value: goal - done, className: 'water-left' },
      ]}
    />
  );
};

export default Water_Goal_Bar;
