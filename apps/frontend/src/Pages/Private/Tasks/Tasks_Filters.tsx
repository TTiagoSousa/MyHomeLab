import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { TASK_PRIORITIES, type BoardProject, type TaskFilters } from '../../../Hooks/Board/boardTypes';
import type { ScheduleAgent } from '../../../Hooks/Schedules/scheduleTypes';
import * as Icon from '../../../Imports/icons';

interface Tasks_Filters_Props {
  search: string;
  filters: TaskFilters;
  project: BoardProject;
  agents: ScheduleAgent[];
  labels: string[];
  onSearch: (value: string) => void;
  onFilter: (name: keyof TaskFilters, value: string) => void;
  onClear: () => void;
}

const Tasks_Filters = ({ search, filters, project, agents, labels, onSearch, onFilter, onClear }: Tasks_Filters_Props) => {
  const { t } = useTranslation('tasks');
  const active = Boolean(search || filters.stateId || filters.priority || filters.assignee || filters.label || filters.moduleId || filters.cycleId);

  const stateOptions = [{ value: '', label: t('filters.allStates') }, ...project.states.map((state) => ({ value: state.id, label: state.name }))];
  const priorityOptions = [{ value: '', label: t('filters.allPriorities') }, ...TASK_PRIORITIES.map((value) => ({ value, label: t(`priority.${value}`) }))];
  const assigneeOptions = [
    { value: '', label: t('filters.allAssignees') },
    { value: 'user', label: t('assignee.user') },
    ...agents.map((agent) => ({ value: agent.key, label: agent.name })),
  ];
  const moduleOptions = [{ value: '', label: t('filters.allModules') }, ...project.modules.map((module) => ({ value: module.id, label: module.name }))];
  const cycleOptions = [{ value: '', label: t('filters.allCycles') }, ...project.cycles.map((cycle) => ({ value: cycle.id, label: cycle.name }))];
  const labelOptions = [{ value: '', label: t('filters.allLabels') }, ...labels.map((label) => ({ value: label, label: `#${label}` }))];

  return (
    <div className='Tasks_Filters'>
      <label className='Tasks_Search'>
        <Icon.Search />
        <input type='search' value={search} placeholder={t('filters.search')} aria-label={t('filters.search')} onChange={(e) => onSearch(e.target.value)} />
      </label>
      <Global_Dropdown value={filters.stateId} options={stateOptions} onChange={(value) => onFilter('stateId', value)} maxVisibleOptions={8} />
      <Global_Dropdown value={filters.priority} options={priorityOptions} onChange={(value) => onFilter('priority', value)} maxVisibleOptions={6} />
      <Global_Dropdown value={filters.assignee} options={assigneeOptions} onChange={(value) => onFilter('assignee', value)} maxVisibleOptions={8} />
      <Global_Dropdown value={filters.moduleId} options={moduleOptions} onChange={(value) => onFilter('moduleId', value)} maxVisibleOptions={8} />
      <Global_Dropdown value={filters.label} options={labelOptions} onChange={(value) => onFilter('label', value)} maxVisibleOptions={8} />
      {project.cycles.length > 0 && (
        <Global_Dropdown value={filters.cycleId} options={cycleOptions} onChange={(value) => onFilter('cycleId', value)} maxVisibleOptions={8} />
      )}
      {active && (
        <button type='button' className='Tasks_Filters_Clear' onClick={onClear}>
          {t('filters.clear')}
        </button>
      )}
    </div>
  );
};

export default Tasks_Filters;
