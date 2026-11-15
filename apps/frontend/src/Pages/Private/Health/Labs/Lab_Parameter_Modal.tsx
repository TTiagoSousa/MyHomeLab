import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLabParameter } from '../../../../Hooks/Health/useLabParameter';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Table_Head from '../Shared/Health_Table_Head';
import { formatDay } from '../Shared/healthFormat';
import Lab_Flag from './Lab_Flag';
import Lab_Parameter_Chart from './Lab_Parameter_Chart';
import { formatLabReference, formatLabValue, labName } from './labFormat';

interface Lab_Parameter_Modal_Props {
  parameterKey: string;
  onClose: () => void;
}

const Lab_Parameter_Modal = ({ parameterKey, onClose }: Lab_Parameter_Modal_Props) => {
  const { t } = useTranslation('health');
  const navigate = useNavigate();
  const { history, loading, error } = useLabParameter(parameterKey);
  const latest = history[history.length - 1];

  return (
    <div className='Health_Month_Modal_Overlay' onClick={onClose}>
      <div className='Health_Month_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Health_card_head'>
          <div>
            <span className='Health_card_title'>{latest ? labName(t, latest) : parameterKey}</span>
            <p className='Health_card_description'>{t('labs.history.description', { count: history.length })}</p>
          </div>
          <button type='button' className='Health_see_all' onClick={onClose}>
            {t('import.close')}
          </button>
        </div>

        {loading && !history.length && <span className='Health_card_description'>{t('loading')}</span>}
        {error && <span className='Health_card_description'>{error}</span>}

        {history.some((point) => point.value != null) && (
          <div className='Health_Box'>
            <Error_Boundary>
              <Lab_Parameter_Chart history={history} />
            </Error_Boundary>
            <span className='Health_card_description'>{t('labs.history.band')}</span>
          </div>
        )}

        <div className='Health_Table labs-history'>
          <Health_Table_Head
            columns={[
              { key: 'date', label: t('labs.columns.date') },
              { key: 'value', label: t('labs.columns.value') },
              { key: 'reference', label: t('labs.columns.reference') },
              { key: 'lab', label: t('labs.columns.lab'), optional: true },
              { key: 'flag', label: '' },
            ]}
          />
          <div className='Health_Table_Body'>
            {history
              .slice()
              .reverse()
              .map((point) => (
                <button
                  key={`${point.reportId}-${point.name}`}
                  type='button'
                  className='Health_Table_Row'
                  onClick={() => navigate(`/MyHomeLab/Health/Labs/${point.reportId}`)}
                >
                  <span className='Health_Table_Day'>{formatDay(point.date)}</span>
                  <span className='Health_Table_Strong'>{formatLabValue(point)}</span>
                  <span>{formatLabReference(point)}</span>
                  <span className='Health_Table_Optional'>{point.lab ?? '—'}</span>
                  <span>
                    <Lab_Flag flag={point.flag} />
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lab_Parameter_Modal;
