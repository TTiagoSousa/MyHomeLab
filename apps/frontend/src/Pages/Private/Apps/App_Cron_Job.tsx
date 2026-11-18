import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { cronJobLabelKey, type CronJob } from '../../../Hooks/ConnectedAccount/useCronJobs';
import * as Icon from '../../../Imports/icons';
import { dateLocale } from '../../../i18n';

interface App_Cron_Job_Props {
  job: CronJob;
  busy: boolean;
  onSave: (intervalMinutes: number) => Promise<boolean>;
  onRun: () => void;
}

const when = (date: string) => new Date(date).toLocaleString(dateLocale(), { dateStyle: 'short', timeStyle: 'short' });

const App_Cron_Job = ({ job, busy, onSave, onRun }: App_Cron_Job_Props) => {
  const { t } = useTranslation('addons');
  const [interval, setInterval] = useState(String(job.intervalMinutes));
  const labels = `cronJobs.jobs.${cronJobLabelKey(job.key)}`;
  const changed = interval !== String(job.intervalMinutes);
  const failed = Boolean(job.lastRunAt) && !job.lastOk;

  const lastRun = !job.lastRunAt
    ? t('cronJobs.neverRan')
    : job.lastOk
      ? t('cronJobs.lastOk', { date: when(job.lastRunAt), result: t(`${labels}.result`, { count: job.lastCount ?? 0 }) })
      : t('cronJobs.lastFailed', { date: when(job.lastRunAt), error: job.lastError ?? '' });

  return (
    <article className={`App_Cron_Job${job.intervalMinutes ? ' on' : ''}`}>
      <div className='App_Cron_Job_icon'>
        <Icon.Clock />
      </div>
      <div className='App_Cron_Job_main'>
        <span className='App_Cron_Job_title'>{t(`${labels}.title`)}</span>
        <span className='App_Cron_Job_text'>{t(`${labels}.description`)}</span>
      </div>
      <div className='App_Cron_Job_times'>
        <span className={failed ? 'error' : ''} title={job.lastError ?? undefined}>
          {lastRun}
        </span>
        <span>{job.intervalMinutes && job.nextRunAt ? t('cronJobs.next', { date: when(job.nextRunAt) }) : t('cronJobs.offShort')}</span>
      </div>
      <div className='App_Cron_Job_controls'>
        <Global_Dropdown
          value={interval}
          options={job.intervals.map((minutes) => ({ value: String(minutes), label: t(`cronJobs.intervals.${minutes}`) }))}
          onChange={setInterval}
          disabled={busy}
        />
        {changed ? (
          <>
            <button type='button' onClick={() => setInterval(String(job.intervalMinutes))} disabled={busy}>
              {t('apps.cancel')}
            </button>
            <button type='button' className='active' onClick={() => void onSave(Number(interval))} disabled={busy}>
              {t('cronJobs.save')}
            </button>
          </>
        ) : (
          <button type='button' onClick={onRun} disabled={busy || job.running}>
            {busy || job.running ? t('cronJobs.running') : t('cronJobs.runNow')}
          </button>
        )}
      </div>
    </article>
  );
};

export default App_Cron_Job;
