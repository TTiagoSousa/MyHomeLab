import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Apps_Section } from '../../Pages/Private/Apps/appsShared';
import { useSchedules } from '../../Hooks/Schedules/useSchedules';
import type { DocLinkType } from '../../Hooks/Docs/docTypes';
import { formatDateTime, scheduleState, scheduleWhen } from '../Schedule_Card/scheduleFormat';
import Schedule_Modal from '../Modals/Schedule_Modal/Schedule_Modal';
import * as Icon from '../../Imports/icons';
import '../Linked_Docs/Linked_Docs.scss';
import './Linked_Schedules.scss';

const PAGE_SIZE = 6;

interface Linked_Schedules_Props {
  type: DocLinkType;
  targetId: string;
  label: string;
}

const Linked_Schedules = ({ type, targetId, label }: Linked_Schedules_Props) => {
  const { t } = useTranslation('schedules');
  const navigate = useNavigate();
  const { schedules, agents, loading, saving, saveSchedule, runSchedule } = useSchedules({ linkType: type, targetId });
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(0);

  const pages = Math.max(1, Math.ceil(schedules.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = schedules.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const agentName = (key: string) => agents.find((agent) => agent.key === key)?.name ?? key;

  return (
    <Apps_Section icon={<Icon.Clock />} title={t('linked.title')} description={t('linked.description', { label })}>
      <div className='Linked_Schedules'>
        {loading && <p className='Linked_Schedules_Note'>{t('loading')}</p>}
        {!loading && schedules.length === 0 && <p className='Linked_Schedules_Note'>{t('linked.empty')}</p>}

        {visible.length > 0 && (
          <div className='Linked_Schedules_Table_Wrap'>
            <table className='Linked_Schedules_Table'>
              <thead>
                <tr>
                  <th>{t('addons:apps.schedulesTable.name')}</th>
                  <th>{t('addons:apps.schedulesTable.when')}</th>
                  <th className='agent'>{t('addons:apps.schedulesTable.agent')}</th>
                  <th>{t('addons:apps.schedulesTable.last')}</th>
                  <th aria-label={t('addons:apps.schedulesTable.actions')} />
                </tr>
              </thead>
              <tbody>
                {visible.map((schedule) => {
                  const state = scheduleState(schedule);
                  const last = schedule.runs[0];
                  const running = last?.status === 'RUNNING';
                  return (
                    <tr
                      key={schedule.id}
                      tabIndex={0}
                      onClick={() => navigate(`/MyHomeLab/Schedules/${schedule.id}`)}
                      onKeyDown={(e) => e.target === e.currentTarget && e.key === 'Enter' && navigate(`/MyHomeLab/Schedules/${schedule.id}`)}
                    >
                      <td className='name'>
                        <span className={`Linked_Schedules_Dot ${state}`} title={t(`state.${state}`)} />
                        <span className='Linked_Schedules_Title' title={schedule.instruction}>
                          {schedule.title}
                        </span>
                      </td>
                      <td>{scheduleWhen(schedule, t)}</td>
                      <td className='agent'>{agentName(schedule.agentKey)}</td>
                      <td className={`last ${last ? last.status.toLowerCase() : 'never'}`}>
                        {last ? `${t(`run.status.${last.status}`)} · ${formatDateTime(last.startedAt)}` : t('addons:apps.schedulesTable.never')}
                      </td>
                      <td className='actions'>
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation();
                            void runSchedule(schedule.id);
                          }}
                          disabled={running}
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
        )}

        {pages > 1 && (
          <div className='Linked_Docs_Pager'>
            <button type='button' className='prev' onClick={() => setPage(current - 1)} disabled={current === 0} aria-label={t('list.previous')}>
              <Icon.Chevron />
            </button>
            <span>{t('list.page', { page: current + 1, pages })}</span>
            <button type='button' onClick={() => setPage(current + 1)} disabled={current === pages - 1} aria-label={t('list.next')}>
              <Icon.Chevron />
            </button>
          </div>
        )}

        <div className='Linked_Schedules_Footer'>
          <button type='button' onClick={() => navigate('/MyHomeLab/Projects?view=triggers')}>
            {t('linked.all')}
          </button>
          <button type='button' className='Linked_Schedules_New' onClick={() => setCreating(true)}>
            <Icon.Plus />
            <span>{t('actions.new')}</span>
          </button>
        </div>
      </div>

      {creating && (
        <Schedule_Modal
          existing={null}
          agents={agents}
          link={{ linkType: type, targetId, targetLabel: label }}
          saving={saving}
          onSave={(payload) => saveSchedule(payload)}
          onClose={() => setCreating(false)}
        />
      )}
    </Apps_Section>
  );
};

export default Linked_Schedules;
