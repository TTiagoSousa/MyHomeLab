import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Server_Modal/Server_Modal.scss';
import '../Schedule_Modal/Schedule_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../Inputs/Global_Dropdown/Global_Dropdown';
import { TASK_PRIORITIES, type BoardProject, type TaskPayload, type TaskPriority } from '../../../Hooks/Board/boardTypes';
import type { ScheduleAgent } from '../../../Hooks/Schedules/scheduleTypes';

interface Task_Modal_Props {
  project: BoardProject;
  stateId: string | null;
  agents: ScheduleAgent[];
  onSave: (payload: TaskPayload) => Promise<string | null>;
  onClose: () => void;
}

const Task_Modal = ({ project, stateId, agents, onSave, onClose }: Task_Modal_Props) => {
  const { t } = useTranslation('tasks');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState(stateId ?? project.states[0]?.id ?? '');
  const [priority, setPriority] = useState<TaskPriority>('NONE');
  const [assignee, setAssignee] = useState(project.agentKeys[0] ?? 'user');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError('');
    const failure = await onSave({
      projectId: project.id,
      title: title.trim(),
      description,
      stateId: state,
      priority,
      assignee: assignee || null,
      dueDate: dueDate ? new Date(`${dueDate}T09:00:00Z`).toISOString() : null,
    });
    setSaving(false);
    if (failure) setError(failure);
    else onClose();
  };

  return (
    <div className='Server_Modal_Overlay' onClick={() => !saving && onClose()}>
      <div className='Server_Modal Schedule_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Server_Modal_Head'>
          <span className='Server_Modal_Mark'>{project.identifier.slice(0, 1) || 'T'}</span>
          <div>
            <span className='Server_Modal_Title'>{t('taskModal.title')}</span>
            <span className='Server_Modal_Kind'>{project.name}</span>
          </div>
        </div>

        <div className='Server_Modal_Field'>
          <label htmlFor='task-title'>{t('taskModal.name')}</label>
          <Global_Input
            id='task-title'
            autoComplete='off'
            value={title}
            maxLength={250}
            placeholder={t('taskModal.namePlaceholder')}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleSave()}
          />
        </div>

        <div className='Server_Modal_Field'>
          <label htmlFor='task-description'>{t('taskModal.description')}</label>
          <textarea
            id='task-description'
            className='Schedule_Modal_Text'
            rows={5}
            maxLength={50000}
            value={description}
            placeholder={t('taskModal.descriptionPlaceholder')}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className='Schedule_Modal_Row'>
          <div className='Server_Modal_Field'>
            <label htmlFor='task-state'>{t('properties.state')}</label>
            <Global_Dropdown
              id='task-state'
              value={state}
              options={project.states.map((item) => ({ value: item.id, label: item.name }))}
              onChange={setState}
              maxVisibleOptions={8}
            />
          </div>
          <div className='Server_Modal_Field'>
            <label htmlFor='task-priority'>{t('properties.priority')}</label>
            <Global_Dropdown
              id='task-priority'
              value={priority}
              options={TASK_PRIORITIES.map((value) => ({ value, label: t(`priority.${value}`) }))}
              onChange={(value) => setPriority(value as TaskPriority)}
            />
          </div>
        </div>

        <div className='Schedule_Modal_Row'>
          <div className='Server_Modal_Field'>
            <label htmlFor='task-assignee'>{t('properties.assignee')}</label>
            <Global_Dropdown
              id='task-assignee'
              value={assignee}
              options={[
                { value: '', label: t('assignee.none') },
                { value: 'user', label: t('assignee.user') },
                ...agents.map((agent) => ({ value: agent.key, label: agent.name })),
              ]}
              onChange={setAssignee}
              maxVisibleOptions={8}
            />
          </div>
          <div className='Server_Modal_Field'>
            <label htmlFor='task-due'>{t('properties.dueDate')}</label>
            <Global_Input id='task-due' type='date' value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <span className='Server_Modal_Hint'>{t('taskModal.assigneeHint')}</span>

        {error && <p className='Server_Modal_Error'>{error}</p>}

        <div className='Server_Modal_Actions'>
          <button type='button' className='Cancel_Button' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </button>
          <button type='button' className='Save_Button' onClick={() => void handleSave()} disabled={saving || !title.trim()}>
            {saving ? t('taskModal.saving') : t('taskModal.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Task_Modal;
