import { useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import { cronJobLabelKey, type CronJob } from '../../../Hooks/ConnectedAccount/useCronJobs';
import * as Icon from '../../../Imports/icons';
import { dateLocale } from '../../../i18n';

export interface Cron_Options_Panel_Props {
  scopeId: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  detail: Record<string, unknown> | null;
  disabled: boolean;
}

interface App_Cron_Job_Props {
  job: CronJob;
  scopeId: string;
  busy: boolean;
  optionsPanel?: ComponentType<Cron_Options_Panel_Props>;
  onSave: (intervalMinutes: number, options: Record<string, unknown> | undefined, time: string | null) => Promise<boolean>;
  onRun: () => void;
}

const DAILY = '1440';

const when = (date: string) => new Date(date).toLocaleString(dateLocale(), { dateStyle: 'short', timeStyle: 'short' });

const App_Cron_Job = ({ job, scopeId, busy, optionsPanel: Options_Panel, onSave, onRun }: App_Cron_Job_Props) => {
  const { t } = useTranslation('addons');
  const [interval, setInterval] = useState(String(job.intervalMinutes));
  const [time, setTime] = useState(job.time ?? '');
  const [options, setOptions] = useState<Record<string, unknown>>(job.options ?? {});
  const [showOptions, setShowOptions] = useState(false);
  const labels = `cronJobs.jobs.${cronJobLabelKey(job.key)}`;
  const optionsChanged = JSON.stringify(options) !== JSON.stringify(job.options ?? {});
  const daily = interval === DAILY;
  const timeChanged = daily && time !== (job.time ?? '');
  const changed = interval !== String(job.intervalMinutes) || optionsChanged || timeChanged;
  const failed = Boolean(job.lastRunAt) && !job.lastOk;

  const lastRun = !job.lastRunAt
    ? t('cronJobs.neverRan')
    : job.lastOk
      ? t('cronJobs.lastOk', { date: when(job.lastRunAt), result: t(`${labels}.result`, { count: job.lastCount ?? 0 }) })
      : t('cronJobs.lastFailed', { date: when(job.lastRunAt), error: job.lastError ?? '' });

  const chooseInterval = (value: string) => {
    setInterval(value);
    if (Options_Panel && value !== '0') setShowOptions(true);
  };

  const cancel = () => {
    setInterval(String(job.intervalMinutes));
    setTime(job.time ?? '');
    setOptions(job.options ?? {});
  };

  const save = () => void onSave(Number(interval), Options_Panel ? options : undefined, daily && time ? time : null);

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
          onChange={chooseInterval}
          disabled={busy}
        />
        {daily && (
          <div className='App_Cron_Job_time' title={`${t('cronJobs.time')}: ${t('cronJobs.timeHint')}`}>
            <Global_Input type='time' value={time} onChange={(e) => setTime(e.target.value)} disabled={busy} />
          </div>
        )}
        {Options_Panel && (
          <button type='button' className={showOptions ? 'selected' : ''} onClick={() => setShowOptions(!showOptions)} aria-expanded={showOptions}>
            {t('cronJobs.options')}
          </button>
        )}
        {changed ? (
          <>
            <button type='button' onClick={cancel} disabled={busy}>
              {t('apps.cancel')}
            </button>
            <button type='button' className='active' onClick={save} disabled={busy}>
              {t('cronJobs.save')}
            </button>
          </>
        ) : (
          <button type='button' onClick={onRun} disabled={busy || job.running}>
            {busy || job.running ? t('cronJobs.running') : t('cronJobs.runNow')}
          </button>
        )}
      </div>
      {Options_Panel && showOptions && (
        <div className='App_Cron_Job_options'>
          <Options_Panel scopeId={scopeId} value={options} onChange={setOptions} detail={job.lastDetail} disabled={busy} />
        </div>
      )}
    </article>
  );
};

export default App_Cron_Job;
