import { useTranslation } from 'react-i18next';
import type { Agent } from '../../../../Hooks/Agent/useAgents';
import { formatAgo } from './workflowFormat';
import { orderTeam } from './workflowTeam';
import * as Icon from '../../../../Imports/icons';

interface Workflow_Agent_List_Props {
  agents: Agent[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onCreate: () => void;
}

const Workflow_Agent_List = ({ agents, selected, onSelect, onCreate }: Workflow_Agent_List_Props) => {
  const { t } = useTranslation('assistant');
  const working = agents.filter((agent) => agent.status === 'ACTIVE').length;

  const statusLine = (agent: Agent) => {
    if (!agent.isActive) return t('workflow.inactive');
    if (agent.status === 'ACTIVE') return agent.action ?? t('core.working');
    if (agent.lastActiveAt) return t('workflow.lastActive', { when: formatAgo(agent.lastActiveAt) });
    return t('workflow.neverActive');
  };

  return (
    <nav className='Workflow_Agents' aria-label={t('workflow.agentsTitle')}>
      <button
        type='button'
        className={`Workflow_Agent all${selected === null ? ' selected' : ''}`}
        onClick={() => onSelect(null)}
      >
        <span className='Workflow_Agent_head'>
          <span className='Workflow_Agent_name'>{t('workflow.allAgents')}</span>
          <span className='Workflow_Agent_count'>{t('workflow.working', { count: working, total: agents.length })}</span>
        </span>
      </button>

      {orderTeam(agents).map(({ agent, depth }) => (
        <button
          key={agent.id}
          type='button'
          style={{ marginLeft: Math.min(depth, 3) * 14 }}
          className={`Workflow_Agent hue-${agent.color}${selected === agent.id ? ' selected' : ''}${agent.status === 'ACTIVE' ? ' active' : ''}${agent.isActive ? '' : ' off'}`}
          onClick={() => onSelect(agent.id)}
        >
          <span className='Workflow_Agent_head'>
            <span className='Workflow_Agent_dot' />
            <span className='Workflow_Agent_name'>{agent.name}</span>
            {agent.isRoot && <span className='Workflow_Agent_badge'>{t('workflow.ceo')}</span>}
          </span>
          <span className='Workflow_Agent_description'>{agent.description}</span>
          <span className='Workflow_Agent_status'>{statusLine(agent)}</span>
        </button>
      ))}

      <button type='button' className={`Workflow_New${selected === 'new' ? ' selected' : ''}`} onClick={onCreate}>
        <Icon.Plus />
        <span>{t('workflow.newAgent')}</span>
      </button>
    </nav>
  );
};

export default Workflow_Agent_List;
