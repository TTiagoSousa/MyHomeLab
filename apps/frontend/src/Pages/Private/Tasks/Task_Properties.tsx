import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import Doc_Tags_Input from '../Docs/Doc_Tags_Input';
import { TASK_PRIORITIES, type BoardProject, type TaskDetail, type TaskPayload, type TaskPriority } from '../../../Hooks/Board/boardTypes';
import type { ScheduleAgent } from '../../../Hooks/Schedules/scheduleTypes';
import { formatDateTime, fromDayInput, toDayInput } from './taskFormat';

interface Task_Properties_Props {
  task: TaskDetail;
  project: BoardProject | undefined;
  agents: ScheduleAgent[];
  onSave: (payload: TaskPayload) => void;
  footer?: ReactNode;
}

const Task_Properties = ({ task, project, agents, onSave, footer }: Task_Properties_Props) => {
  const { t } = useTranslation('tasks');
  const modules = project?.modules ?? [];
  const selected = task.modules.map((module) => module.id);

  const toggleModule = (id: string) =>
    onSave({ moduleIds: selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id] });

  return (
    <aside className='Task_Properties'>
      <div className='Task_Property'>
        <span>{t('properties.state')}</span>
        <Global_Dropdown
          value={task.stateId}
          options={(project?.states ?? [task.state]).map((state) => ({ value: state.id, label: state.name }))}
          onChange={(value) => onSave({ stateId: value })}
          maxVisibleOptions={10}
        />
      </div>
      <div className='Task_Property'>
        <span>{t('properties.priority')}</span>
        <Global_Dropdown
          value={task.priority}
          options={TASK_PRIORITIES.map((value) => ({ value, label: t(`priority.${value}`) }))}
          onChange={(value) => onSave({ priority: value as TaskPriority })}
        />
      </div>
      <div className='Task_Property'>
        <span>{t('properties.assignee')}</span>
        <Global_Dropdown
          value={task.assignee ?? ''}
          options={[
            { value: '', label: t('assignee.none') },
            { value: 'user', label: t('assignee.user') },
            ...agents.map((agent) => ({ value: agent.key, label: agent.name })),
          ]}
          onChange={(value) => onSave({ assignee: value || null })}
          maxVisibleOptions={8}
        />
      </div>
      <div className='Task_Property'>
        <span>{t('properties.startDate')}</span>
        <Global_Input type='date' value={toDayInput(task.startDate)} onChange={(e) => onSave({ startDate: fromDayInput(e.target.value) })} />
      </div>
      <div className='Task_Property'>
        <span>{t('properties.dueDate')}</span>
        <Global_Input type='date' value={toDayInput(task.dueDate)} onChange={(e) => onSave({ dueDate: fromDayInput(e.target.value) })} />
      </div>
      {project && project.cycles.length > 0 && (
        <div className='Task_Property'>
          <span>{t('properties.cycle')}</span>
          <Global_Dropdown
            value={task.cycleId ?? ''}
            options={[{ value: '', label: t('bulk.noCycle') }, ...project.cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))]}
            onChange={(value) => onSave({ cycleId: value || null })}
            maxVisibleOptions={8}
          />
        </div>
      )}
      <div className='Task_Property'>
        <span>{t('properties.modules')}</span>
        <div className='Task_Modules'>
          {modules.length === 0 && <small>{t('properties.noModules')}</small>}
          {modules.map((module) => (
            <button key={module.id} type='button' className={selected.includes(module.id) ? 'active' : ''} aria-pressed={selected.includes(module.id)} onClick={() => toggleModule(module.id)}>
              {module.name}
            </button>
          ))}
        </div>
      </div>
      <div className='Task_Property Schedule_Tags_Field'>
        <span>{t('properties.labels')}</span>
        <Doc_Tags_Input id='task-labels' tags={task.labels} onChange={(labels) => onSave({ labels })} />
      </div>
      <div className='Task_Property_Meta'>
        <span>{t('properties.created', { date: formatDateTime(task.createdAt), by: task.createdBy === 'user' ? t('assignee.user') : task.createdBy })}</span>
        <span>{t('properties.updated', { date: formatDateTime(task.updatedAt) })}</span>
      </div>
      {footer}
    </aside>
  );
};

export default Task_Properties;
