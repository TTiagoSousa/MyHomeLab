import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import type { ScheduleAgent } from '../../../Hooks/Schedules/scheduleTypes';
import * as Icon from '../../../Imports/icons';

const SCHEDULE_STATE_FILTERS = ['on', 'off', 'done'];

interface Schedules_Filters_Props {
  search: string;
  state: string;
  agent: string;
  tag: string;
  agents: ScheduleAgent[];
  tags: string[];
  onSearch: (value: string) => void;
  onState: (value: string) => void;
  onAgent: (value: string) => void;
  onTag: (value: string) => void;
}

const Schedules_Filters = ({ search, state, agent, tag, agents, tags, onSearch, onState, onAgent, onTag }: Schedules_Filters_Props) => {
  const { t } = useTranslation('schedules');

  const stateOptions = [
    { value: '', label: t('filters.allStates') },
    ...SCHEDULE_STATE_FILTERS.map((value) => ({ value, label: t(`state.${value}`) })),
  ];
  const agentOptions = [{ value: '', label: t('filters.allAgents') }, ...agents.map((item) => ({ value: item.key, label: item.name }))];
  const tagOptions = [{ value: '', label: t('filters.allTags') }, ...tags.map((value) => ({ value, label: `#${value}` }))];

  return (
    <div className='Schedules_filters'>
      <label className='Schedules_search'>
        <Icon.Search />
        <input
          type='search'
          value={search}
          placeholder={t('filters.search')}
          aria-label={t('filters.search')}
          onChange={(e) => onSearch(e.target.value)}
        />
      </label>
      <Global_Dropdown value={state} options={stateOptions} onChange={onState} />
      <Global_Dropdown value={agent} options={agentOptions} onChange={onAgent} maxVisibleOptions={8} searchable={agents.length > 8} />
      <Global_Dropdown value={tag} options={tagOptions} onChange={onTag} maxVisibleOptions={8} searchable={tags.length > 8} />
    </div>
  );
};

export default Schedules_Filters;
