import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BackupJob } from '../../../Hooks/Backups/backupTypes';
import { Apps_Hint, Apps_Pager } from './appsShared';
import { formatBytes } from '../Servers/format';
import { dateLocale } from '../../../i18n';

const PAGE_SIZE = 10;

const App_Backup_History = ({ job }: { job: BackupJob }) => {
  const { t } = useTranslation(['addons', 'servers']);
  const [page, setPage] = useState(0);

  const pages = Math.max(1, Math.ceil(job.runs.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = job.runs.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <div className='Apps_modal_table'>
      <h3>{t('servers:backups.historyTitle')}</h3>
      <p>
        {job.destination.name} · /{job.destination.folder}/{job.folder}
      </p>
      <div className='Apps_table_scroll'>
        <table className='Apps_table'>
          <thead>
            <tr>
              <th>{t('servers:backups.columns.date')}</th>
              <th>{t('servers:backups.columns.result')}</th>
              <th>{t('servers:backups.columns.file')}</th>
              <th>{t('servers:backups.columns.size')}</th>
              <th>{t('servers:backups.columns.cleaned')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((run) => {
              const failed = run.status === 'ERROR';
              const partial = !failed && run.missing.length > 0;
              const hint = failed ? (run.error ?? undefined) : partial ? t('servers:backups.missing', { list: run.missing.join(', ') }) : undefined;
              return (
              <tr key={run.id}>
                <td>{new Date(run.startedAt).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                <td className={failed || partial ? 'error wrap' : 'ok wrap'}>
                  <Apps_Hint hint={hint}>
                    {t(`servers:backups.result.${failed ? 'ERROR' : partial ? 'PARTIAL' : 'SUCCESS'}`)}
                  </Apps_Hint>
                  {run.manual && ` · ${t('servers:backups.manual')}`}
                </td>
                <td className='name'>{run.fileName?.split('/').pop() ?? '—'}</td>
                <td>{run.status === 'ERROR' ? '—' : formatBytes(run.sizeBytes)}</td>
                <td>{run.deleted ? t('servers:backups.deleted', { count: run.deleted }) : '—'}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Apps_Pager page={current} pages={pages} onChange={setPage} />
    </div>
  );
};

export default App_Backup_History;
