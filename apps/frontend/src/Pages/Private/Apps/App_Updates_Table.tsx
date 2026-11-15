import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { UPDATE_CLOSED, type AccountUpdate } from '../../../Hooks/ConnectedAccount/useAccountUpdates';
import { updateStatusKey } from './updateStatus';
import { Apps_Hint, Apps_Pager } from './appsShared';
import { dateLocale } from '../../../i18n';

const PAGE_SIZE = 10;

interface App_Updates_Table_Props {
  updates: AccountUpdate[];
  appName: string;
  footer?: ReactNode;
}

const App_Updates_Table = ({ updates, appName, footer }: App_Updates_Table_Props) => {
  const { t } = useTranslation('addons');
  const [page, setPage] = useState(0);

  const pages = Math.max(1, Math.ceil(updates.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = updates.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <div className='Apps_modal_table'>
      <h3>{t('apps.updates.historyTitle', { name: appName })}</h3>
      <p>{t('apps.updates.historyHint')}</p>
      <div className='Apps_table_scroll'>
        <table className='Apps_table'>
          <thead>
            <tr>
              <th>{t('apps.updates.columns.component')}</th>
              <th>{t('apps.updates.columns.version')}</th>
              <th>{t('apps.updates.columns.status')}</th>
              <th>{t('apps.updates.columns.risk')}</th>
              <th>{t('apps.updates.columns.task')}</th>
              <th>{t('apps.updates.columns.date')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((update) => (
              <tr key={update.id} className={UPDATE_CLOSED.includes(update.status) ? 'closed' : ''}>
                <td className='name wrap'>
                  <Apps_Hint hint={update.summary ?? undefined}>{update.componentTitle ?? appName}</Apps_Hint>
                </td>
                <td>
                  {update.releaseUrl ? (
                    <a href={update.releaseUrl} target='_blank' rel='noreferrer'>
                      {update.fromVersion} → {update.toVersion}
                    </a>
                  ) : (
                    `${update.fromVersion} → ${update.toVersion}`
                  )}
                </td>
                <td className={update.status === 'DONE' ? 'ok' : update.status === 'FAILED' ? 'error' : 'wrap'}>
                  <Apps_Hint hint={t(`apps.updates.statusHint.${updateStatusKey(update)}`)}>{t(`apps.updates.status.${updateStatusKey(update)}`)}</Apps_Hint>
                </td>
                <td className='wrap'>{update.risk ? t(`apps.updates.risk.${update.risk}`, { defaultValue: update.risk }) : '—'}</td>
                <td>{update.boardTaskKey ?? '—'}</td>
                <td>{new Date(update.createdAt).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Apps_Pager page={current} pages={pages} onChange={setPage} />
      {footer}
    </div>
  );
};

export default App_Updates_Table;
