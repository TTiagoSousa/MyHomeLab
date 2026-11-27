import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Server_Modal/Server_Modal.scss';
import '../Backup_Job_Modal/Backup_Job_Modal.scss';
import './Schedule_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../Inputs/Global_Dropdown/Global_Dropdown';
import Doc_Tags_Input from '../../../Pages/Private/Docs/Doc_Tags_Input';
import '../../Schedule_Card/Schedule_Tags.scss';
import {
  SCHEDULE_REPEATS,
  type Schedule,
  type ScheduleAgent,
  type ScheduleLink,
  type SchedulePayload,
  type ScheduleRepeat,
} from '../../../Hooks/Schedules/scheduleTypes';

interface Schedule_Modal_Props {
  existing: Schedule | null;
  agents: ScheduleAgent[];
  link: ScheduleLink | null;
  saving: boolean;
  onSave: (payload: SchedulePayload) => Promise<string | null>;
  onClose: () => void;
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

const pad = (value: number) => String(value).padStart(2, '0');

const toLocalInput = (iso: string | null) => {
  const date = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const Schedule_Modal = ({ existing, agents, link, saving, onSave, onClose }: Schedule_Modal_Props) => {
  const { t } = useTranslation('schedules');
  const forUpdate = Boolean(existing?.updateId);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [agentKey, setAgentKey] = useState(existing?.agentKey ?? agents.find((agent) => agent.key === 'infra')?.key ?? agents[0]?.key ?? '');
  const [instruction, setInstruction] = useState(existing?.instruction ?? '');
  const [repeat, setRepeat] = useState<ScheduleRepeat>(existing?.repeat ?? 'DAILY');
  const [runAt, setRunAt] = useState(toLocalInput(existing?.runAt ?? null));
  const [time, setTime] = useState(existing?.time ?? '05:00');
  const [weekday, setWeekday] = useState(String(existing?.weekday ?? 1));
  const [monthDay, setMonthDay] = useState(String(existing?.monthDay ?? 1));
  const [notify, setNotify] = useState(existing?.notify ?? true);
  const [toChat, setToChat] = useState(existing?.toChat ?? false);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [error, setError] = useState('');

  const day = Number(monthDay);
  const dayValid = Number.isInteger(day) && day >= 1 && day <= 31;
  const whenValid = repeat === 'ONCE' ? Boolean(runAt) : /^\d{2}:\d{2}$/.test(time) && (repeat !== 'MONTHLY' || dayValid);
  const canSave = !saving && whenValid && (forUpdate || (title.trim() && instruction.trim() && agentKey));
  const shownLink = existing?.targetLabel ?? link?.targetLabel;

  const handleSave = async () => {
    if (!canSave) return;
    setError('');
    const when: SchedulePayload =
      repeat === 'ONCE'
        ? { repeat, runAt: new Date(runAt).toISOString() }
        : {
            repeat,
            time,
            weekday: repeat === 'WEEKLY' ? Number(weekday) : null,
            monthDay: repeat === 'MONTHLY' ? day : null,
          };
    const payload: SchedulePayload = forUpdate
      ? { runAt: new Date(runAt).toISOString(), notify, toChat, enabled }
      : {
          title: title.trim(),
          agentKey,
          instruction: instruction.trim(),
          ...when,
          tags,
          notify,
          toChat,
          enabled,
          ...(!existing && link ? link : {}),
        };
    const failure = await onSave(payload);
    if (failure) setError(failure);
    else onClose();
  };

  return (
    <div className='Server_Modal_Overlay' onClick={() => !saving && onClose()}>
      <div className='Server_Modal Backup_Job_Modal Schedule_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Server_Modal_Head'>
          <span className='Server_Modal_Mark'>A</span>
          <div>
            <span className='Server_Modal_Title'>{existing ? t('modal.editTitle') : t('modal.title')}</span>
            <span className='Server_Modal_Kind'>{shownLink ? t('modal.linkedTo', { label: shownLink }) : t('modal.kind')}</span>
          </div>
        </div>

        {forUpdate ? (
          <p className='Server_Modal_Text'>{t('modal.updateText', { title: existing!.title })}</p>
        ) : (
          <>
            <div className='Server_Modal_Field'>
              <label htmlFor='schedule-title'>{t('modal.name')}</label>
              <Global_Input
                id='schedule-title'
                autoComplete='off'
                value={title}
                maxLength={120}
                placeholder={t('modal.namePlaceholder')}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className='Server_Modal_Field'>
              <label htmlFor='schedule-agent'>{t('modal.agent')}</label>
              <Global_Dropdown
                id='schedule-agent'
                value={agentKey}
                options={agents.map((agent) => ({
                  value: agent.key,
                  label: agent.isActive ? agent.name : t('modal.agentOff', { name: agent.name }),
                }))}
                onChange={setAgentKey}
              />
            </div>

            <div className='Server_Modal_Field'>
              <label htmlFor='schedule-instruction'>{t('modal.instruction')}</label>
              <textarea
                id='schedule-instruction'
                className='Schedule_Modal_Text'
                rows={5}
                maxLength={4000}
                value={instruction}
                placeholder={t('modal.instructionPlaceholder')}
                onChange={(e) => setInstruction(e.target.value)}
              />
              <span className='Server_Modal_Hint'>{t('modal.instructionHint')}</span>
            </div>

            <div className='Server_Modal_Field Schedule_Tags_Field'>
              <label htmlFor='schedule-tags'>{t('modal.tags')}</label>
              <Doc_Tags_Input id='schedule-tags' tags={tags} onChange={setTags} />
              <span className='Server_Modal_Hint'>{t('modal.tagsHint')}</span>
            </div>

            <div className='Server_Modal_Field'>
              <label>{t('modal.when')}</label>
              <div className='Backup_Job_Modal_Retentions Schedule_Modal_Repeats'>
                {SCHEDULE_REPEATS.map((option) => (
                  <button key={option} type='button' className={repeat === option ? 'active' : ''} onClick={() => setRepeat(option)}>
                    <span>{t(`repeat.${option}`)}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {repeat === 'ONCE' || forUpdate ? (
          <div className='Server_Modal_Field'>
            <label htmlFor='schedule-run-at'>{t('modal.runAt')}</label>
            <Global_Input id='schedule-run-at' type='datetime-local' value={runAt} onChange={(e) => setRunAt(e.target.value)} />
          </div>
        ) : (
          <div className='Schedule_Modal_Row'>
            {repeat === 'WEEKLY' && (
              <div className='Server_Modal_Field'>
                <label htmlFor='schedule-weekday'>{t('modal.weekday')}</label>
                <Global_Dropdown
                  id='schedule-weekday'
                  value={weekday}
                  options={WEEKDAYS.map((value) => ({ value: String(value), label: t(`weekdays.${value}`) }))}
                  onChange={setWeekday}
                  searchable={false}
                />
              </div>
            )}
            {repeat === 'MONTHLY' && (
              <div className={`Server_Modal_Field${monthDay && !dayValid ? ' invalid' : ''}`}>
                <label htmlFor='schedule-month-day'>{t('modal.monthDay')}</label>
                <Global_Input id='schedule-month-day' type='number' min='1' max='31' value={monthDay} onChange={(e) => setMonthDay(e.target.value)} />
              </div>
            )}
            <div className='Server_Modal_Field'>
              <label htmlFor='schedule-time'>{t('modal.time')}</label>
              <Global_Input id='schedule-time' type='time' value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
        )}
        <span className='Server_Modal_Hint'>{t('modal.timeZone')}</span>

        <label className='Server_Modal_Check'>
          <span>
            {t('modal.notify')}
            <small>{t('modal.notifyHint')}</small>
          </span>
          <input type='checkbox' checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        </label>

        <label className='Server_Modal_Check'>
          <span>
            {t('modal.toChat')}
            <small>{t('modal.toChatHint')}</small>
          </span>
          <input type='checkbox' checked={toChat} onChange={(e) => setToChat(e.target.checked)} />
        </label>

        <label className='Server_Modal_Check'>
          <span>
            {t('modal.enabled')}
            <small>{t('modal.enabledHint')}</small>
          </span>
          <input type='checkbox' checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        </label>

        {error && <p className='Server_Modal_Error'>{error}</p>}

        <div className='Server_Modal_Actions'>
          <button type='button' className='Cancel_Button' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </button>
          <button type='button' className='Save_Button' onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? t('modal.saving') : t('modal.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Schedule_Modal;
