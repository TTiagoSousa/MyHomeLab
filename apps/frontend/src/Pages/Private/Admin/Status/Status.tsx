import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSystemStatus } from '../../../../Hooks/Admin/useSystemStatus';
import { dateLocale } from '../../../../i18n';
import * as Icon from '../../../../Imports/icons';
import './Status.scss';

const formatTime = (date: string | null) =>
  date ? new Date(date).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const Status = () => {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const { status, error, fetchStatus } = useSystemStatus();

  return (
    <div className='Status'>
      <header>
        <div className='Right_Side Status_Title'>
          <button type='button' className='Status_Back' onClick={() => navigate('/MyHomeLab/Admin')}>
            <Icon.Chevron />
            <span>{t('title')}</span>
          </button>
          <span>{t('status.title')}</span>
        </div>
        <div className='Left_Side'>
          <button type='button' className='Status_Refresh' onClick={() => void fetchStatus()}>
            {t('status.refresh')}
          </button>
        </div>
      </header>

      {error && <p className='Status_Note error'>{error}</p>}
      {status && (
        <>
          <div className='Status_Cards'>
            <div className={`Status_Card ${status.database.ok ? 'ok' : 'bad'}`}>
              <span className='Status_Label'>{t('status.database')}</span>
              <strong>{status.database.ok ? t('status.dbOk', { ms: status.database.ms }) : t('status.dbBad')}</strong>
              {status.database.error && <small>{status.database.error}</small>}
            </div>
            <div className='Status_Card ok'>
              <span className='Status_Label'>{t('status.backend')}</span>
              <strong>{t('status.uptime', { time: formatUptime(status.uptimeSeconds) })}</strong>
              <small>
                {status.node} · {status.memoryMb} MB
              </small>
            </div>
            <div className={`Status_Card ${status.counts.failedRuns ? 'warn' : 'ok'}`}>
              <span className='Status_Label'>{t('status.triggers')}</span>
              <strong>{t('status.failedRuns', { count: status.counts.failedRuns })}</strong>
              <small>{t('status.runningRuns', { count: status.counts.runningRuns })}</small>
            </div>
            <div className={`Status_Card ${status.counts.studyErrors || status.counts.boardErrors ? 'warn' : 'ok'}`}>
              <span className='Status_Label'>{t('status.updates')}</span>
              <strong>{t('status.studyErrors', { count: status.counts.studyErrors })}</strong>
              <small>{t('status.openNotifications', { count: status.counts.openNotifications })}</small>
            </div>
          </div>

          <section className='Status_Panel'>
            <span className='Status_Label'>{t('status.jobs')}</span>
            <div className='Status_Table'>
              <div className='Status_Row head'>
                <span>{t('status.job')}</span>
                <span>{t('status.lastRun')}</span>
                <span>{t('status.nextRun')}</span>
              </div>
              {status.jobs.map((job) => (
                <div key={job.name} className='Status_Row'>
                  <span>{job.name}</span>
                  <span>{formatTime(job.lastRun)}</span>
                  <span>{formatTime(job.nextRun)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className='Status_Panel'>
            <span className='Status_Label'>{t('status.problems')}</span>
            {status.problems.length === 0 && <p className='Status_Note'>{t('status.noProblems')}</p>}
            {status.problems.map((problem, index) => (
              <div key={`${problem.at}-${index}`} className={`Status_Problem ${problem.level}`}>
                <span className='Status_Problem_Head'>
                  {formatTime(problem.at)} · {problem.context || '—'}
                </span>
                <span>{problem.message}</span>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
};

export default Status;
