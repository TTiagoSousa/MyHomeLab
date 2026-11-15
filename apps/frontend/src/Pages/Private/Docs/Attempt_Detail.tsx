import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUpdateAttempt } from '../../../Hooks/Updates/useUpdateAttempt';
import type { UpdateAttemptCheck, UpdateCheckPhase } from '../../../Hooks/Updates/updateAttemptTypes';
import { dateLocale } from '../../../i18n';
import { APP_PAGES } from '../../../Constants/appPages';
import { attemptStatus, attemptTitle } from '../../../Hooks/Updates/attemptLabels';
import Inline_Markdown from '../../../Components/Inline_Markdown/Inline_Markdown';
import './Attempt_Detail.scss';

const formatDateTime = (date: string) =>
  new Date(date).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const PHASES: UpdateCheckPhase[] = ['BEFORE', 'AFTER'];

const LONG_EVIDENCE = 220;

const Check_Row = ({ check }: { check: UpdateAttemptCheck }) => {
  const { t } = useTranslation('docs');
  const [expanded, setExpanded] = useState(false);
  const long = (check.evidence?.length ?? 0) > LONG_EVIDENCE;

  return (
    <li className={`Attempt_Check ${check.state.toLowerCase()}`}>
      <span className='Attempt_Check_State'>{t(`attempts.states.${check.state}`)}</span>
      <div className='Attempt_Check_Body'>
        <span className='Attempt_Check_Point'>
          <small>{check.position}</small>
          <span>
            <Inline_Markdown text={check.point} />
          </span>
        </span>
        <span className='Attempt_Check_Meta'>
          {t(`attempts.who.${check.who}`)}
          {check.source && check.who !== 'code' && ` · ${check.source}`}
          {check.proof && (
            <>
              {' · '}
              <Inline_Markdown text={t('attempts.proof', { proof: check.proof })} />
            </>
          )}
        </span>
        {check.evidence && (
          <span className={`Attempt_Check_Evidence${long && !expanded ? ' clamped' : ''}`}>
            <Inline_Markdown text={check.evidence} />
          </span>
        )}
        {long && (
          <button type='button' className='Attempt_Check_More' onClick={() => setExpanded(!expanded)}>
            {expanded ? t('attempts.showLess') : t('attempts.showMore')}
          </button>
        )}
        {check.checkedAt && (
          <span className='Attempt_Check_Meta'>
            {t('attempts.checked', { date: formatDateTime(check.checkedAt), by: check.checkedBy ?? '—' })}
          </span>
        )}
      </div>
    </li>
  );
};

const Attempt_Detail = ({ attemptId }: { attemptId: string }) => {
  const { t } = useTranslation('docs');
  const navigate = useNavigate();
  const { attempt, loading, error } = useUpdateAttempt(attemptId);

  if (!attempt || attempt.id !== attemptId) {
    return <p className='Docs_detail_note'>{loading || !error ? t('detail.loading') : error}</p>;
  }

  const count = (state: UpdateAttemptCheck['state']) => attempt.checks.filter((check) => check.state === state).length;
  const total = attempt.checks.length || 1;
  const parts = (['VALIDATED', 'NOT_APPLICABLE', 'SKIPPED', 'NOT_VALIDATED', 'PENDING'] as const).map((state) => ({ state, value: count(state) }));
  const targetPage = attempt.account
    ? APP_PAGES[attempt.account.provider] && `${APP_PAGES[attempt.account.provider]}/${attempt.account.id}`
    : attempt.hostServer && `/MyHomeLab/Apps/Proxmox/${attempt.hostServer.id}`;

  return (
    <article className='Attempt_Detail'>
      <header className='Attempt_Detail_Head'>
        <div>
          <h1>{attemptTitle(attempt, t)}</h1>
          <span className='Attempt_Detail_Meta'>
            {t('attempts.started', { date: formatDateTime(attempt.startedAt) })}
            {attempt.finishedAt && ` · ${t('attempts.finished', { date: formatDateTime(attempt.finishedAt) })}`}
          </span>
        </div>
        <span className={`Attempt_Status ${attempt.status.toLowerCase()}`}>{attemptStatus(attempt, t)}</span>
      </header>

      <p className='Attempt_Detail_Note'>{t('attempts.note')}</p>

      <div className='Attempt_Progress' aria-hidden='true'>
        {parts.map((part) =>
          part.value ? <span key={part.state} className={part.state.toLowerCase()} style={{ width: `${(part.value / total) * 100}%` }} /> : null,
        )}
      </div>
      <div className='Attempt_Legend'>
        {parts.filter((part) => part.value > 0).map((part) => (
          <span key={part.state} className={part.state.toLowerCase()}>
            {t(`attempts.states.${part.state}`)}: {part.value}
          </span>
        ))}
      </div>

      {PHASES.map((phase) => {
        const checks = attempt.checks.filter((check) => check.phase === phase);
        return (
          <section key={phase} className='Attempt_Phase'>
            <h2>{t(`attempts.phases.${phase}`)}</h2>
            {checks.length ? (
              <ul>
                {checks.map((check) => (
                  <Check_Row key={check.id} check={check} />
                ))}
              </ul>
            ) : (
              <p className='Attempt_Detail_Meta'>{t('attempts.noPoints')}</p>
            )}
          </section>
        );
      })}

      {attempt.result && (
        <section className='Attempt_Phase'>
          <h2>{t('attempts.result')}</h2>
          <pre className='Attempt_Result'>{attempt.result}</pre>
        </section>
      )}

      {attempt.docs && attempt.docs.length > 0 && (
        <section className='Attempt_Phase'>
          <h2>{t('attempts.rules')}</h2>
          <div className='Attempt_Docs'>
            {attempt.docs.map((doc) => (
              <button key={doc.id} type='button' onClick={() => navigate(`/MyHomeLab/Docs/${doc.id}`)}>
                {doc.title}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className='Attempt_Actions'>
        {attempt.update.logDocId && (
          <button type='button' onClick={() => navigate(`/MyHomeLab/Docs/${attempt.update.logDocId}`)}>
            {t('attempts.openLog')}
          </button>
        )}
        {targetPage && (
          <button type='button' className='active' onClick={() => navigate(targetPage)}>
            {t(attempt.account ? 'attempts.openApp' : 'attempts.openServer')}
          </button>
        )}
      </div>
    </article>
  );
};

export default Attempt_Detail;
