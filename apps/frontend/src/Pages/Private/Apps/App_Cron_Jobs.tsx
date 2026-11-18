import { useEffect, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import './Apps.scss';
import './App_Cron_Jobs.scss';
import { cronJobLabelKey, useCronJobs, type CronScope } from '../../../Hooks/ConnectedAccount/useCronJobs';
import { dateLocale } from '../../../i18n';
import { Apps_Detail_Header } from './appsShared';
import App_Cron_Job, { type Cron_Options_Panel_Props } from './App_Cron_Job';

interface App_Cron_Jobs_Props {
  scope: CronScope;
  optionPanels?: Record<string, ComponentType<Cron_Options_Panel_Props>>;
  backTo: string;
  backLabel: string;
  note?: string;
}

const App_Cron_Jobs = ({ scope, optionPanels, backTo, backLabel, note }: App_Cron_Jobs_Props) => {
  const { t } = useTranslation('addons');
  const { jobs, loading, busy, fetchJobs, saveInterval, runNow } = useCronJobs(scope);

  const title = (key: string) => t(`cronJobs.jobs.${cronJobLabelKey(key)}.title`);
  const sorted = [...jobs].sort((a, b) => title(a.key).localeCompare(title(b.key), dateLocale()));

  useEffect(() => {
    void fetchJobs();
  }, [scope.id]);

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
              key={`${job.key}:${job.intervalMinutes}:${JSON.stringify(job.options)}`}
              job={job}
              scopeId={scope.id ?? ''}
              busy={busy === job.key}
              optionsPanel={optionPanels?.[job.key]}
              onSave={(intervalMinutes, options) => saveInterval(job.key, intervalMinutes, options)}
              onRun={() => void runNow(job.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default App_Cron_Jobs;
