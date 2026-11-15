import { useTranslation } from 'react-i18next';
import { changeClass, formatChange } from './wellbeingFormat';

interface Wellbeing_Metric_Props {
  label: string;
  value: string;
  change?: number | null;
  unit?: string;
  sub?: string;
}

const Wellbeing_Metric = ({ label, value, change, unit = '', sub }: Wellbeing_Metric_Props) => {
  const { t } = useTranslation('health');

  return (
    <div className='Wellbeing_Metric'>
      <span>{label}</span>
      <em>{value}</em>
      {change != null ? (
        <small className={`Wellbeing_Change ${changeClass(change)}`}>
          {t('wellbeing.vsPrevious', { value: `${formatChange(change)}${unit}` })}
        </small>
      ) : (
        sub && <small>{sub}</small>
      )}
    </div>
  );
};

export default Wellbeing_Metric;
