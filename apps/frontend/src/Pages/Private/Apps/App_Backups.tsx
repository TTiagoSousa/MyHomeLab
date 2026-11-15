import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import './App_Backups.scss';
import type { BackupJob } from '../../../Hooks/Backups/backupTypes';
import { useBackupDestinations } from '../../../Hooks/Backups/useBackupDestinations';
import { useBackupJobs } from '../../../Hooks/Backups/useBackupJobs';
import { FREQUENCY_SHORT } from '../../../Constants/runFrequency';
import Backup_Job_Modal from '../../../Components/Modals/Backup_Job_Modal/Backup_Job_Modal';
import { dateLocale } from '../../../i18n';
import { formatBytes } from '../Servers/format';
import { Apps_Hint, Apps_Section } from './appsShared';
import App_Modal from './App_Modal';
import App_Backup_History from './App_Backup_History';
import * as Icon from '../../../Imports/icons';

const formatDateTime = (date: string) =>
  new Date(date).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

interface App_Backups_Props {
  accountId: string;
  serviceName: string;
  defaultFolder: string;
  fileExample: string;
  textKey: string;
}

const App_Backups = ({ accountId, serviceName, defaultFolder, fileExample, textKey }: App_Backups_Props) => {
  const { t } = useTranslation(['addons', 'servers']);
  const navigate = useNavigate();
  const { destinations, loading: loadingDestinations } = useBackupDestinations();
  const { jobs, loading, saving, runningId, saveJob, removeJob, runJob } = useBackupJobs(accountId);
  const [editing, setEditing] = useState<BackupJob | 'new' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [historyOf, setHistoryOf] = useState<BackupJob | null>(null);

  const retentionText = (job: BackupJob) =>
    job.retention === 'KEEP_LAST'
      ? t('servers:backups.retention.KEEP_LAST.short', { count: job.keepCount })
      : t(`servers:backups.retention.${job.retention}.short`);

  const handleRemove = async (id: string) => {
    if (confirmRemove !== id) {
      setConfirmRemove(id);
      return;
    }
    setConfirmRemove(null);
    await removeJob(id);
  };

  const lastRun = (job: BackupJob) => {
    const last = job.runs[0];
    if (!last) return <span className='App_Backups_meta'>{t('servers:backups.never')}</span>;
    if (last.status === 'ERROR') {
      return (
        <Apps_Hint hint={last.error}>
          <span className='App_Backups_meta error'>{t('servers:backups.lastFailedShort', { date: formatDateTime(last.startedAt) })}</span>
        </Apps_Hint>
      );
    }
    return (
      <Apps_Hint hint={t('servers:backups.lastOkHint', { file: last.fileName?.split('/').pop(), size: formatBytes(last.sizeBytes) })}>
        <span className='App_Backups_meta ok'>{t('servers:backups.lastOkShort', { date: formatDateTime(last.startedAt) })}</span>
      </Apps_Hint>
    );
  };

  return (
    <Apps_Section
      icon={<Icon.Refresh />}
      title={t('servers:backups.title')}
      description={t(`${textKey}.description`)}
      onAdd={destinations.length ? () => setEditing('new') : undefined}
      addLabel={t('servers:backups.add')}
    >
      {!loadingDestinations && destinations.length === 0 && (
        <div className='App_Backups_empty'>
          <span>{t('servers:backups.noDestination')}</span>
          <button type='button' onClick={() => navigate('/MyHomeLab/Apps')}>
            {t('servers:backups.createDestination')}
          </button>
        </div>
      )}

      {!loading && destinations.length > 0 && jobs.length === 0 && (
        <button type='button' className='Apps_section_connect' onClick={() => setEditing('new')}>
          <Icon.Plus />
          <span>{t('servers:backups.add')}</span>
        </button>
      )}

      {jobs.map((job) => (
        <div className='App_Backups_job' key={job.id}>
          <div className='App_Backups_job_main'>
            <span className='App_Backups_path'>
              {job.destination.name} · /{job.destination.folder}/{job.folder}
            </span>
            <span className='App_Backups_line'>
              <span className='App_Backups_meta'>
                {job.isActive ? t(FREQUENCY_SHORT[job.runFrequency]) : t('servers:backups.paused')} · {retentionText(job)}
              </span>
              {lastRun(job)}
            </span>
          </div>

          <div className='App_Backups_actions'>
            <button type='button' className='active' onClick={() => void runJob(job.id)} disabled={runningId === job.id}>
              {runningId === job.id ? t('servers:backups.running') : t('servers:backups.runNow')}
            </button>
            {job.runs.length > 0 && (
              <button type='button' onClick={() => setHistoryOf(job)}>
                {t('servers:backups.history', { count: job.runs.length })}
              </button>
            )}
            <button type='button' onClick={() => setEditing(job)}>
              {t('servers:monitors.edit')}
            </button>
            <button type='button' className='danger' onClick={() => void handleRemove(job.id)}>
              {confirmRemove === job.id ? t('servers:monitors.confirmRemove') : t('servers:monitors.remove')}
            </button>
          </div>

        </div>
      ))}

      <details className='App_Backups_history'>
        <summary>{t('servers:backups.whatTitle')}</summary>
        <p>{t(`${textKey}.included`)}</p>
        <p>{t(`${textKey}.notIncluded`)}</p>
        <p>{t(`${textKey}.restore`)}</p>
      </details>

      {historyOf && (
        <App_Modal onClose={() => setHistoryOf(null)}>
          <App_Backup_History job={historyOf} />
        </App_Modal>
      )}

      {editing && (
        <Backup_Job_Modal
          serviceName={serviceName}
          defaultFolder={defaultFolder}
          fileExample={fileExample}
          existing={editing === 'new' ? null : editing}
          destinations={destinations}
          saving={saving}
          onSave={(payload) => saveJob(payload, editing === 'new' ? undefined : editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </Apps_Section>
  );
};

export default App_Backups;
