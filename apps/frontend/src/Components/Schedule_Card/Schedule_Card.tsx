import { useTranslation } from 'react-i18next';
import type { Schedule, ScheduleAgent } from '../../Hooks/Schedules/scheduleTypes';
import { formatDateTime, scheduleState, scheduleWhen } from './scheduleFormat';
import * as Icon from '../../Imports/icons';
import './Schedule_Card.scss';

interface Schedule_Card_Props {
  schedule: Schedule;
  agents: ScheduleAgent[];
  onRun: () => void;
  onOpen: () => void;
}

const Schedule_Card = ({ schedule, agents, onRun, onOpen }: Schedule_Card_Props) => {
  const { t } = useTranslation('schedules');

  const agentName = agents.find((agent) => agent.key === schedule.agentKey)?.name ?? schedule.agentKey;
  const last = schedule.runs[0];
  const running = last?.status === 'RUNNING';
  const state = scheduleState(schedule);

  return (
    <div className={`Schedule_Card ${state}`}>
      <div className='Schedule_Card_Head'>
        <span className='Schedule_Card_Icon'>
          <Icon.Clock />
        </span>
        <div className='Schedule_Card_Title'>
          <span title={schedule.title}>{schedule.title}</span>
          <small>
            {scheduleWhen(schedule, t)} · {agentName}
          </small>
        </div>
        <span className={`Schedule_Card_State ${state}`}>{t(`state.${state}`)}</span>
      </div>

      <p className='Schedule_Card_Instruction'>{schedule.instruction}</p>

      <div className='Schedule_Card_Tags'>
        {schedule.tags.map((tag) => (
          <span key={tag}>#{tag}</span>
        ))}
        {schedule.targetLabel && <span className='link'>{schedule.targetLabel}</span>}
      </div>

      <div className={`Schedule_Card_Last ${last ? last.status.toLowerCase() : 'never'}`}>
        <span className='Schedule_Card_Dot' />
        <span>
          {last ? `${t(`run.status.${last.status}`)} · ${formatDateTime(last.startedAt)}` : t('never')}
          {last?.notice && ` · ${t('card.notice')}`}
        </span>
      </div>

      <div className='Schedule_Card_Actions'>
        <button type='button' onClick={onOpen}>
          {t('actions.more')}
        </button>
        <button type='button' className='active' onClick={onRun} disabled={running}>
          {running ? t('actions.running') : t('actions.run')}
        </button>
      </div>
    </div>
  );
};

export default Schedule_Card;
