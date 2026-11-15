import { useTranslation } from 'react-i18next';
import type { LabResult } from '../../../../Hooks/Health/healthTypes';
import { formatDay } from '../Shared/healthFormat';
import Lab_Flag from './Lab_Flag';
import Lab_Range_Bar from './Lab_Range_Bar';
import { formatLabReference, labName, labNumber } from './labFormat';

type RowResult = LabResult & { previousValue?: number | null; previousDate?: string | null; count?: number };

interface Lab_Parameter_Row_Props {
  result: RowResult;
  percent: LabResult | null;
  onOpen: (key: string) => void;
}

const Lab_Parameter_Row = ({ result, percent, onOpen }: Lab_Parameter_Row_Props) => {
  const { t } = useTranslation('health');
  const reference = formatLabReference(result);
  const delta =
    result.value != null && result.previousValue != null ? Math.round((result.value - result.previousValue) * 1000) / 1000 : null;

  return (
    <button type='button' className={`Lab_Row${result.flag ? ' flagged' : ''}`} onClick={() => onOpen(result.key)}>
      <span className='Lab_Row_Name'>
        <strong>{labName(t, result)}</strong>
        <small>
          {reference !== '—' ? t('labs.reference', { value: reference }) : result.value != null ? t('labs.noReference') : ''}
          {result.count && result.count > 1 ? ` · ${t('labs.measurements', { count: result.count })}` : ''}
        </small>
      </span>

      <Lab_Range_Bar result={result} />

      <span className='Lab_Row_Value'>
        <em>{result.value != null ? labNumber(result.value) : (result.valueText ?? '—')}</em>
        {result.unit && <small>{result.unit}</small>}
        {percent?.value != null && <small className='Lab_Row_Percent'>{labNumber(percent.value)}%</small>}
      </span>

      <span className='Lab_Row_Trend'>
        {delta != null && result.previousDate
          ? t(delta > 0 ? 'labs.trend.up' : delta < 0 ? 'labs.trend.down' : 'labs.trend.same', {
              value: labNumber(Math.abs(delta)),
              date: formatDay(result.previousDate, false),
            })
          : ''}
      </span>

      <Lab_Flag flag={result.flag} />
    </button>
  );
};

export default Lab_Parameter_Row;
