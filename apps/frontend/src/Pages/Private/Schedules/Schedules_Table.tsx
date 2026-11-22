import { useTranslation } from 'react-i18next';
import type { Schedule, ScheduleAgent } from '../../../Hooks/Schedules/scheduleTypes';
import { formatDateTime, scheduleState, scheduleWhen } from '../../../Components/Schedule_Card/scheduleFormat';
import * as Icon from '../../../Imports/icons';
import './Schedules_Table.scss';

interface Schedules_Table_Props {
  schedules: Schedule[];
  agents: ScheduleAgent[];
  onOpen: (schedule: Schedule) => void;
  onRun: (schedule: Schedule) => void;
}

const COLUMNS = ['name', 'when', 'agent', 'next', 'last', 'state'] as const;

const Schedules_Table = ({ schedules, agents, onOpen, onRun }: Schedules_Table_Props) => {
  const { t } = useTranslation('schedules');
  const agentName = (key: string) => agents.find((agent) => agent.key === key)?.name ?? key;

  return (
    <div className='Schedules_Table_Scroll'>
      <table className='Schedules_Table'>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column}>{t(`table.${column}`)}</th>
            ))}
            <th aria-label={t('actions.run')} />
          </tr>
        </thead>
        <tbody>
          {schedules.map((schedule) => {
            const last = schedule.runs[0];
            const running = last?.status === 'RUNNING';
            const state = scheduleState(schedule);
            return (
              <tr
                key={schedule.id}
                tabIndex={0}
                onClick={() => onOpen(schedule)}
                onKeyDown={(e) => e.target === e.currentTarget && e.key === 'Enter' && onOpen(schedule)}
              >
                <td className='Schedules_Table_Name'>
                  <span className='Schedules_Table_Title' title={schedule.title}>
                    {schedule.title}
                  </span>
                  <span className='Schedules_Table_Meta'>
                    {schedule.toChat && <Icon.Chat />}
                    {schedule.tags.map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                    {schedule.targetLabel && <span className='link'>{schedule.targetLabel}</span>}
                  </span>
                </td>
                <td>{scheduleWhen(schedule, t)}</td>
                <td>{agentName(schedule.agentKey)}</td>
                <td>{schedule.enabled && schedule.nextRunAt ? formatDateTime(schedule.nextRunAt) : '—'}</td>
                <td>
                  <span className={`Schedules_Table_Last ${last ? last.status.toLowerCase() : 'never'}`}>
                    <span className='Schedules_Table_Dot' />
                    {last ? `${t(`run.status.${last.status}`)} · ${formatDateTime(last.startedAt)}` : '—'}
                  </span>
                </td>
                <td>
                  <span className={`Schedules_Table_State ${state}`}>{t(`state.${state}`)}</span>
                </td>
                <td className='Schedules_Table_Action'>
                  <button
                    type='button'
                    disabled={running}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRun(schedule);
                    }}
                  >
                    {running ? t('actions.running') : t('actions.run')}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default Schedules_Table;
