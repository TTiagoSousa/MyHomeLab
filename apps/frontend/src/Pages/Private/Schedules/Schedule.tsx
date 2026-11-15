import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useSchedule } from '../../../Hooks/Schedules/useSchedule';
import { useAgentNames } from '../../../Hooks/Agent/useAgentNames';
import type { SchedulePayload } from '../../../Hooks/Schedules/scheduleTypes';
import { formatDateTime, scheduleState, scheduleWhen } from '../../../Components/Schedule_Card/scheduleFormat';
import Schedule_Modal from '../../../Components/Modals/Schedule_Modal/Schedule_Modal';
import Doc_Tags_Input from '../Docs/Doc_Tags_Input';
import { Apps_Section } from '../Apps/appsShared';
import Schedule_Run from './Schedule_Run';
import * as Icon from '../../../Imports/icons';
import '../Apps/Apps.scss';
import '../../../Components/Schedule_Card/Schedule_Tags.scss';
import './Schedule.scss';

const SCHEDULES_PATH = '/MyHomeLab/Projects?view=triggers';

const Schedule = () => {
  const { t } = useTranslation('schedules');
  const { scheduleId } = useParams();
  const navigate = useNavigate();
  const { schedule, loading, saving, error, saveSchedule, runSchedule, deleteSchedule } = useSchedule(scheduleId);
  const { agents } = useAgentNames();
  const [editingTime, setEditingTime] = useState(false);
  const [editingText, setEditingText] = useState(false);
  const [text, setText] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState('');

  const back = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(SCHEDULES_PATH);
  };

  const save = async (payload: SchedulePayload) => {
    setActionError('');
    const failure = await saveSchedule(payload);
    if (failure) setActionError(failure);
    return failure;
  };

  const startEditingText = () => {
    setText(schedule?.instruction ?? '');
    setEditingText(true);
  };

  const saveText = async () => {
    if (!text.trim()) return;
    if (!(await save({ instruction: text.trim() }))) setEditingText(false);
  };

  const remove = async () => {
    if (await deleteSchedule()) navigate(SCHEDULES_PATH, { replace: true });
  };

  const agentName = (key: string) => agents.find((agent) => agent.key === key)?.name ?? key;
  const state = schedule ? scheduleState(schedule) : 'off';
  const running = schedule?.runs[0]?.status === 'RUNNING';

  return (
    <div className='Apps Schedule_Page'>
      <header>
        <div className='Right_Side Apps_back_title'>
          <button type='button' className='Apps_back' onClick={back}>
            <Icon.Chevron />
            <span>{t('title')}</span>
          </button>
          <span>{schedule?.title ?? ''}</span>
        </div>
      </header>

      {!schedule ? (
        <p className='Apps_intro'>{loading ? t('loading') : error || t('detail.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <Apps_Section icon={<Icon.Clock />} title={t('detail.info')} description={`${scheduleWhen(schedule, t)} · ${agentName(schedule.agentKey)}`}>
            <div className='Schedule_Page_Chips'>
              <span className={`state ${state}`}>{t(`state.${state}`)}</span>
              {schedule.enabled && schedule.nextRunAt && <span>{t('next', { date: formatDateTime(schedule.nextRunAt) })}</span>}
              <span>{schedule.createdBy === 'user' ? t('createdByYou') : t('createdBy', { name: agentName(schedule.createdBy) })}</span>
              {schedule.targetLabel && <span>{t('linkedTo', { label: schedule.targetLabel })}</span>}
              {schedule.updateId && <span>{t('forUpdate')}</span>}
              <span>{schedule.notify ? t('notifies') : t('silent')}</span>
            </div>

            {actionError && <p className='Apps_section_note error'>{actionError}</p>}

            <div className='Apps_footer'>
              {confirming ? (
                <>
                  <button type='button' onClick={() => setConfirming(false)}>
                    {t('common:actions.cancel')}
                  </button>
                  <button type='button' className='danger' onClick={() => void remove()}>
                    {t('actions.confirmDelete')}
                  </button>
                </>
              ) : (
                <>
                  <button type='button' className='danger' onClick={() => setConfirming(true)}>
                    {t('actions.delete')}
                  </button>
                  <button type='button' onClick={() => void save({ enabled: !schedule.enabled })} disabled={saving}>
                    {schedule.enabled ? t('actions.disable') : t('actions.enable')}
                  </button>
                  <button type='button' onClick={() => setEditingTime(true)}>
                    {t('actions.edit')}
                  </button>
                  <button type='button' className='active' onClick={() => void runSchedule()} disabled={running}>
                    {running ? t('actions.running') : t('actions.run')}
                  </button>
                </>
              )}
            </div>
          </Apps_Section>

          <Apps_Section icon={<Icon.Doc />} title={t('detail.instruction')} description={t('modal.instructionHint')}>
            {editingText ? (
              <>
                <textarea
                  className='Schedule_Page_Text'
                  rows={8}
                  maxLength={4000}
                  value={text}
                  autoFocus
                  onChange={(e) => setText(e.target.value)}
                />
                <div className='Apps_footer'>
                  <button type='button' onClick={() => setEditingText(false)} disabled={saving}>
                    {t('common:actions.cancel')}
                  </button>
                  <button type='button' className='active' onClick={() => void saveText()} disabled={saving || !text.trim()}>
                    {saving ? t('modal.saving') : t('modal.save')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className='Schedule_Page_Instruction'>{schedule.instruction}</p>
                <div className='Apps_footer'>
                  <button type='button' onClick={startEditingText}>
                    {t('actions.editText')}
                  </button>
                </div>
              </>
            )}
          </Apps_Section>

          <Apps_Section icon={<Icon.Folder />} title={t('detail.tags')} description={t('detail.tagsHint')}>
            <div className='Schedule_Tags_Field'>
              <Doc_Tags_Input id='schedule-tags' tags={schedule.tags} onChange={(tags) => void save({ tags })} />
            </div>
          </Apps_Section>

          <Apps_Section icon={<Icon.Clock />} title={t('detail.history')} description={t('detail.historyHint')}>
            <div className='Schedule_Page_Runs'>
              {schedule.runs.length ? (
                schedule.runs.map((run) => <Schedule_Run key={run.id} run={run} />)
              ) : (
                <p className='Apps_section_note'>{t('never')}</p>
              )}
            </div>
          </Apps_Section>
        </div>
      )}

      {editingTime && schedule && (
        <Schedule_Modal
          existing={schedule}
          agents={agents}
          link={null}
          saving={saving}
          onSave={save}
          onClose={() => setEditingTime(false)}
        />
      )}
    </div>
  );
};

export default Schedule;
