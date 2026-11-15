import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Apps_Pager } from '../../Pages/Private/Apps/appsShared';
import App_Modal from '../../Pages/Private/Apps/App_Modal';
import App_Updates_Panel from '../../Pages/Private/Apps/App_Updates_Panel';
import { useUpdateAttempts } from '../../Hooks/Updates/useUpdateAttempts';
import { attemptStatus } from '../../Hooks/Updates/attemptLabels';
import Update_Attempts_Rows from './Update_Attempts_Rows';
import * as Icon from '../../Imports/icons';
import '../Linked_Docs/Linked_Docs.scss';
import './Update_Attempts.scss';

const PAGE_SIZE = 10;

const Update_Attempts = ({ accountId, label }: { accountId: string; label: string }) => {
  const { t } = useTranslation('docs');
  const navigate = useNavigate();
  const { attempts, loading, error } = useUpdateAttempts(accountId);
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(0);

  const pages = Math.max(1, Math.ceil(attempts.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const latest = attempts[0];

  const summary = loading
    ? t('linked.loading')
    : latest
      ? t('attempts.latest', {
          kind: t(`attempts.kind.${latest.kind}`),
          from: latest.fromVersion,
          to: latest.toVersion,
          status: attemptStatus(latest, t),
        })
      : t('attempts.empty');

  const openAll = () => {
    const params = new URLSearchParams({ kind: 'ATTEMPT', link: 'APP', target: accountId, targetLabel: label });
    navigate(`/MyHomeLab/Docs?${params.toString()}`);
  };

  return (
    <>
      <App_Updates_Panel
        id='app-attempts'
        icon={<Icon.Shield />}
        title={t('attempts.sectionTitle')}
        summary={summary}
        collapsible={false}
        action={
          <div className='Apps_updates_actions'>
            <span className='Apps_updates_badge'>{loading ? '—' : t('attempts.count', { count: attempts.length })}</span>
            {attempts.length > 0 && (
              <button type='button' onClick={() => setShowAll(true)}>
                {t('attempts.view')}
              </button>
            )}
          </div>
        }
      >
        {error && <p className='Apps_section_note error'>{error}</p>}
      </App_Updates_Panel>

      {showAll && (
        <App_Modal onClose={() => setShowAll(false)}>
          <div className='Apps_modal_table'>
            <h3>{t('attempts.sectionTitle')}</h3>
            <p>{label}</p>
            <p>{t('attempts.legend')}</p>
            <Update_Attempts_Rows attempts={attempts.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)} />
            <Apps_Pager page={current} pages={pages} onChange={setPage} />
            <div className='Apps_footer'>
              <button type='button' onClick={openAll}>
                {t('attempts.openInDocs')}
              </button>
            </div>
          </div>
        </App_Modal>
      )}
    </>
  );
};

export default Update_Attempts;
