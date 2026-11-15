import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { TASK_PRIORITIES, type BoardProject, type TaskPayload, type TaskPriority } from '../../../Hooks/Board/boardTypes';
import type { ScheduleAgent } from '../../../Hooks/Schedules/scheduleTypes';

interface Tasks_Bulk_Bar_Props {
  count: number;
  project: BoardProject;
  agents: ScheduleAgent[];
  onApply: (payload: TaskPayload) => Promise<void>;
  onClear: () => void;
}

const KEEP = '';
const NONE = '__none__';

const Tasks_Bulk_Bar = ({ count, project, agents, onApply, onClear }: Tasks_Bulk_Bar_Props) => {
  const { t } = useTranslation('tasks');
  const [stateId, setStateId] = useState(KEEP);
  const [priority, setPriority] = useState(KEEP);
  const [assignee, setAssignee] = useState(KEEP);
  const [cycleId, setCycleId] = useState(KEEP);
  const [saving, setSaving] = useState(false);

  const keep = { value: KEEP, label: t('bulk.keep') };
  const changed = Boolean(stateId || priority || assignee || cycleId);

  const apply = async () => {
    setSaving(true);
    await onApply({
      ...(stateId ? { stateId } : {}),
      ...(priority ? { priority: priority as TaskPriority } : {}),
      ...(assignee ? { assignee: assignee === NONE ? null : assignee } : {}),
      ...(cycleId ? { cycleId: cycleId === NONE ? null : cycleId } : {}),
    });
    setSaving(false);
  };

  return (
    <div className='Tasks_Bulk_Bar'>
      <span className='Tasks_Bulk_Count'>{t('bulk.count', { count })}</span>
      <div className='Tasks_Bulk_Field'>
        <Global_Dropdown value={stateId} options={[{ ...keep, label: t('bulk.state') }, ...project.states.map((state) => ({ value: state.id, label: state.name }))]} onChange={setStateId} maxVisibleOptions={8} />
      </div>
      <div className='Tasks_Bulk_Field'>
        <Global_Dropdown value={priority} options={[{ ...keep, label: t('bulk.priority') }, ...TASK_PRIORITIES.map((value) => ({ value, label: t(`priority.${value}`) }))]} onChange={setPriority} />
      </div>
      <div className='Tasks_Bulk_Field'>
        <Global_Dropdown
          value={assignee}
          options={[
            { ...keep, label: t('bulk.assignee') },
            { value: NONE, label: t('assignee.none') },
            { value: 'user', label: t('assignee.user') },
            ...agents.map((agent) => ({ value: agent.key, label: agent.name })),
          ]}
          onChange={setAssignee}
          maxVisibleOptions={8}
        />
      </div>
      {project.cycles.length > 0 && (
        <div className='Tasks_Bulk_Field'>
          <Global_Dropdown
            value={cycleId}
            options={[{ ...keep, label: t('bulk.cycle') }, { value: NONE, label: t('bulk.noCycle') }, ...project.cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))]}
            onChange={setCycleId}
            maxVisibleOptions={8}
          />
        </div>
      )}
      <button type='button' className='Tasks_Solid' onClick={() => void apply()} disabled={!changed || saving}>
        {saving ? t('bulk.applying') : t('bulk.apply')}
      </button>
      <button type='button' className='Tasks_Ghost' onClick={onClear}>
        {t('bulk.clear')}
      </button>
    </div>
  );
};

export default Tasks_Bulk_Bar;
