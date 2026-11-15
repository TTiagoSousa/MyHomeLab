import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ScheduleRun } from '../../../Hooks/Schedules/scheduleTypes';
import { formatDateTime, runTokens } from '../../../Components/Schedule_Card/scheduleFormat';

const Schedule_Run = ({ run }: { run: ScheduleRun }) => {
  const { t } = useTranslation('schedules');
  const hasTokens = run.status !== 'RUNNING' && run.tokensIn + run.tokensOut > 0;

  return (
    <div className={`Schedule_Run ${run.status.toLowerCase()}`}>
      <span className='Schedule_Run_Head'>
        <span className='Schedule_Run_Dot' />
        {t(`run.status.${run.status}`)} · {formatDateTime(run.startedAt)}
        {hasTokens && ` · ${t('run.tokens', { tokens: runTokens(run) })}`}
      </span>
      {run.notice && <span className='Schedule_Run_Notice'>{run.notice}</span>}
      {run.summary && <p className='Schedule_Run_Summary'>{run.summary}</p>}
      {run.docsUsed && run.docsUsed.length > 0 && (
        <span className='Schedule_Run_Docs'>
          {t('run.docsUsed')}{' '}
          {run.docsUsed.map((doc) => (
            <Link key={doc.id} to={`/MyHomeLab/Docs/${doc.id}`}>
              {doc.title}
            </Link>
          ))}
        </span>
      )}
    </div>
  );
};

export default Schedule_Run;
