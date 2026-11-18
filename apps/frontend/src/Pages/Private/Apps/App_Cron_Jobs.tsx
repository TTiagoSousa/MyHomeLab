import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './Apps.scss';
import './App_Cron_Jobs.scss';
import { cronJobLabelKey, useCronJobs } from '../../../Hooks/ConnectedAccount/useCronJobs';
import { dateLocale } from '../../../i18n';
import { Apps_Detail_Header } from './appsShared';
import App_Cron_Job from './App_Cron_Job';

interface App_Cron_Jobs_Props {
  accountId: string | undefined;
  backTo: string;
  backLabel: string;
  note?: string;
}

const App_Cron_Jobs = ({ accountId, backTo, backLabel, note }: App_Cron_Jobs_Props) => {
  const { t } = useTranslation('addons');
  const { jobs, loading, busy, fetchJobs, saveInterval, runNow } = useCronJobs(accountId);

  const title = (key: string) => t(`cronJobs.jobs.${cronJobLabelKey(key)}.title`);
  const sorted = [...jobs].sort((a, b) => title(a.key).localeCompare(title(b.key), dateLocale()));

  useEffect(() => {
    void fetchJobs();
  }, [accountId]);

  return (
    <div className='Apps'>
      <Apps_Detail_Header backTo={backTo} backLabel={backLabel} title={t('cronJobs.title')} />
      <p className='Apps_intro'>
        {t('cronJobs.description')}
        {note ? ` ${note}` : ''}
      </p>
      {loading ? (
        <p className='Apps_intro'>{t('apps.loading')}</p>
      ) : !jobs.length ? (
        <p className='Apps_intro'>{t('cronJobs.empty')}</p>
      ) : (
        <div className='App_Cron_Jobs_list'>
          {sorted.map((job) => (
            <App_Cron_Job
              key={`${job.key}:${job.intervalMinutes}`}
              job={job}
              busy={busy === job.key}
              onSave={(intervalMinutes) => saveInterval(job.key, intervalMinutes)}
              onRun={() => void runNow(job.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default App_Cron_Jobs;
