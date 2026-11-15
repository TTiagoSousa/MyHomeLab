import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import { BASE_URL } from '../../../../config/urls';
import { End_Points } from '../../../../Service/endPoints';
import { useLabReport } from '../../../../Hooks/Health/useLabReport';
import Lab_Report_Modal from '../../../../Components/Modals/Lab_Report_Modal/Lab_Report_Modal';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay } from '../Shared/healthFormat';
import Lab_Categories from './Lab_Categories';
import Lab_Parameter_Modal from './Lab_Parameter_Modal';

const Lab_Report_Page = () => {
  const { t } = useTranslation('health');
  const navigate = useNavigate();
  const { reportId } = useParams();
  const { report, loading, error, fetchReport, removeReport } = useLabReport(reportId ?? null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [parameterKey, setParameterKey] = useState<string | null>(null);
  const outOfRange = report?.results.filter((result) => result.flag && !result.key.endsWith('_pct')).length ?? 0;

  const handleDelete = async () => {
    if (!report) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (await removeReport()) navigate('/MyHomeLab/Health/Labs');
    else setConfirmDelete(false);
  };

  return (
    <div className='Health_Dashboard'>
      <header>
        <div className='Right_Side'>
          <button type='button' className='Health_back' onClick={() => navigate('/MyHomeLab/Health/Labs')}>
            ← {t('labs.title')}
          </button>
          <span>{report ? `${formatDay(report.collectedAt, false)} · ${report.lab ?? t('labs.unknownLab')}` : t('labs.reportTitle')}</span>
        </div>
        {report && (
          <div className='Left_Side'>
            {report.hasPdf && (
              <a
                className='Health_see_all'
                href={`${BASE_URL}${End_Points.Health_Lab_Pdf_Endpoint(report.id)}`}
                target='_blank'
                rel='noreferrer'
              >
                {t('labs.openPdf')}
              </a>
            )}
            <button type='button' className='Health_see_all' onClick={() => setEditOpen(true)}>
              {t('labs.edit')}
            </button>
            <button
              type='button'
              className={`Health_see_all danger${confirmDelete ? ' confirm' : ''}`}
              onClick={() => void handleDelete()}
              onBlur={() => setConfirmDelete(false)}
            >
              {confirmDelete ? t('labs.confirmDelete') : t('labs.delete')}
            </button>
          </div>
        )}
      </header>

      {error && <div className='Health_empty'>{error}</div>}
      {!report && !error && <div className='Health_empty'>{loading ? t('loading') : ''}</div>}

      {report && (
        <>
          <section className='Health_card'>
            <div className='Health_Stats columns-4'>
              <Health_Stat highlight label={t('labs.stats.results')} value={String(report.results.filter((result) => !result.key.endsWith('_pct')).length)} />
              <Health_Stat label={t('labs.stats.outOfRange')} value={String(outOfRange)} />
              <Health_Stat label={t('labs.stats.lab')} value={report.lab ?? '—'} />
              <Health_Stat label={t('labs.stats.source')} value={t(`labs.sources.${report.source}`)} sub={report.fileName ?? undefined} />
            </div>
            {report.notes && <p className='Health_Notes'>{report.notes}</p>}
          </section>

          <Lab_Categories results={report.results} onOpen={setParameterKey} />
        </>
      )}

      {editOpen && report && (
        <Lab_Report_Modal
          initial={report}
          source={report.source}
          file={null}
          reportId={report.id}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            fetchReport();
          }}
        />
      )}

      {parameterKey && <Lab_Parameter_Modal parameterKey={parameterKey} onClose={() => setParameterKey(null)} />}
    </div>
  );
};

export default Lab_Report_Page;
