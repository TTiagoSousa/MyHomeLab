import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LabReportSummary } from '../../../../Hooks/Health/healthTypes';
import Health_Table_Head from '../Shared/Health_Table_Head';
import { formatDay } from '../Shared/healthFormat';

interface Lab_Reports_Panel_Props {
  reports: LabReportSummary[];
}

const Lab_Reports_Panel = ({ reports }: Lab_Reports_Panel_Props) => {
  const { t } = useTranslation('health');
  const navigate = useNavigate();

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('labs.reports', { count: reports.length })}</span>
          <p className='Health_card_description'>{t('labs.reportsDescription')}</p>
        </div>
      </div>

      <div className='Health_Table labs-reports'>
        <Health_Table_Head
          columns={[
            { key: 'date', label: t('labs.columns.date') },
            { key: 'lab', label: t('labs.columns.lab') },
            { key: 'source', label: t('labs.columns.source'), optional: true },
            { key: 'results', label: t('labs.columns.results') },
            { key: 'out', label: t('labs.columns.outOfRange') },
          ]}
        />
        <div className='Health_Table_Body'>
          {reports.map((report) => (
            <button
              key={report.id}
              type='button'
              className='Health_Table_Row'
              onClick={() => navigate(`/MyHomeLab/Health/Labs/${report.id}`)}
            >
              <span className='Health_Table_Day'>{formatDay(report.collectedAt)}</span>
              <span className='Health_Table_Strong'>{report.lab ?? '—'}</span>
              <span className='Health_Table_Optional'>{t(`labs.sources.${report.source}`)}</span>
              <span>{report.results}</span>
              <span className={report.outOfRange ? 'Lab_Out' : ''}>
                {report.outOfRange ? t('labs.outCount', { count: report.outOfRange }) : t('labs.allInRange')}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Lab_Reports_Panel;
