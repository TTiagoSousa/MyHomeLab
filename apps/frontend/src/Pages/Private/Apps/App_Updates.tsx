import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UPDATE_CLOSED, useAccountUpdates } from '../../../Hooks/ConnectedAccount/useAccountUpdates';
import App_Updates_Panel from './App_Updates_Panel';
import App_Updates_Table from './App_Updates_Table';
import App_Modal from './App_Modal';

interface App_Updates_Props {
  accountId: string;
  appName: string;
}

const App_Updates = ({ accountId, appName }: App_Updates_Props) => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { updates, loading, error, fetchUpdates } = useAccountUpdates(accountId);
  const [showTable, setShowTable] = useState(false);

  const pending = updates.filter((update) => !UPDATE_CLOSED.includes(update.status));
  const ordered = [...pending, ...updates.filter((update) => UPDATE_CLOSED.includes(update.status))];
  const newest = pending[0];

  const summary = loading
    ? t('apps.loading')
    : newest
      ? t('apps.updates.newest', { name: newest.componentTitle ?? appName, from: newest.fromVersion, to: newest.toVersion })
      : t('apps.updates.upToDate');

  return (
    <>
      <App_Updates_Panel
        title={t('apps.updates.title')}
        summary={summary}
        collapsible={false}
        action={
          <div className='Apps_updates_actions'>
            <span className={`Apps_updates_badge${pending.length ? ' has' : ''}`}>
              {loading ? '—' : pending.length ? t('apps.updates.count', { count: pending.length }) : t('apps.updates.none')}
            </span>
            {updates.length > 0 && (
              <button type='button' className={pending.length ? 'primary' : ''} onClick={() => setShowTable(true)}>
                {t('apps.proxmox.viewUpdates')}
              </button>
            )}
          </div>
        }
      >
        {error && <p className='Apps_section_note error'>{error}</p>}
      </App_Updates_Panel>

      {showTable && (
        <App_Modal onClose={() => setShowTable(false)}>
          <App_Updates_Table
            updates={ordered}
            appName={appName}
            footer={
              <div className='Apps_footer'>
                <button type='button' onClick={() => navigate('/MyHomeLab/Projects')}>
                  {t('apps.updates.board')}
                </button>
                <button type='button' onClick={() => void fetchUpdates()} disabled={loading}>
                  {t('apps.updates.refresh')}
                </button>
              </div>
            }
          />
        </App_Modal>
      )}
    </>
  );
};

export default App_Updates;
