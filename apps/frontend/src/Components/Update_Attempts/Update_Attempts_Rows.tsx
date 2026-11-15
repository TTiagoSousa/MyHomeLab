import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { UpdateAttemptSummary } from '../../Hooks/Updates/updateAttemptTypes';
import { Apps_Hint } from '../../Pages/Private/Apps/appsShared';
import { dateLocale } from '../../i18n';
import { attemptStatus, attemptStatusHint } from '../../Hooks/Updates/attemptLabels';

const formatDateTime = (date: string) =>
  new Date(date).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const Update_Attempts_Rows = ({ attempts }: { attempts: UpdateAttemptSummary[] }) => {
  const { t } = useTranslation('docs');
  const navigate = useNavigate();

  const countsHint = (attempt: UpdateAttemptSummary) =>
    t('attempts.countsHint', {
      validated: attempt.counts.validated,
      notApplicable: attempt.counts.notApplicable,
      skipped: attempt.counts.skipped ?? 0,
      notValidated: attempt.counts.notValidated,
      pending: attempt.counts.pending,
    });

  return (
    <div className='Update_Attempts'>
      <div className='Update_Attempts_Row head'>
        <span>{t('attempts.columns.date')}</span>
        <span>{t('attempts.columns.kind')}</span>
        <span>{t('attempts.columns.version')}</span>
        <span>{t('attempts.columns.rules')}</span>
        <span>{t('attempts.columns.status')}</span>
      </div>
      {attempts.map((attempt) => (
        <button key={attempt.id} type='button' className='Update_Attempts_Row' onClick={() => navigate(`/MyHomeLab/Docs/attempts/${attempt.id}`)}>
          <span>
            <Apps_Hint hint={attempt.finishedAt ? t('attempts.finishedHint', { date: formatDateTime(attempt.finishedAt) }) : undefined}>
              {formatDateTime(attempt.startedAt)}
            </Apps_Hint>
          </span>
          <span className={`Update_Attempts_Kind ${attempt.kind.toLowerCase()}`}>{t(`attempts.kind.${attempt.kind}`)}</span>
          <span>
            {attempt.fromVersion} → {attempt.toVersion}
            {attempt.installNumber && attempt.installNumber > 1 && <small>{t('attempts.number', { number: attempt.installNumber })}</small>}
          </span>
          <span>
            <Apps_Hint hint={countsHint(attempt)}>
              {t('attempts.counts', {
                validated: attempt.counts.validated + attempt.counts.notApplicable + (attempt.counts.skipped ?? 0),
                total: attempt.counts.total,
              })}
            </Apps_Hint>
            {attempt.counts.notValidated > 0 && <small className='failed'>{t('attempts.countsFailed', { count: attempt.counts.notValidated })}</small>}
          </span>
          <span className={`Update_Attempts_Status ${attempt.status.toLowerCase()}`}>
            <Apps_Hint hint={attemptStatusHint(attempt, t)}>{attemptStatus(attempt, t)}</Apps_Hint>
          </span>
        </button>
      ))}
    </div>
  );
};

export default Update_Attempts_Rows;
