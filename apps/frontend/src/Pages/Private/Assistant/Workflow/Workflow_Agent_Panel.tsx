import { useTranslation } from 'react-i18next';
import type { Agent } from '../../../../Hooks/Agent/useAgents';
import type { AgentToolOption } from '../../../../Hooks/Agent/useAgentTools';
import Workflow_Activity from './Workflow_Activity';
import Workflow_Agent_Editor from './Workflow_Agent_Editor';

export type WorkflowTab = 'activity' | 'config';

interface Workflow_Agent_Panel_Props {
  agent: Agent;
  agents: Agent[];
  tools: AgentToolOption[];
  tab: WorkflowTab;
  version: number;
  onTab: (tab: WorkflowTab) => void;
  onSaved: (agents: Agent[]) => void;
  onDeleted: (agents: Agent[]) => void;
}

const Workflow_Agent_Panel = ({ agent, agents, tools, tab, version, onTab, onSaved, onDeleted }: Workflow_Agent_Panel_Props) => {
  const { t } = useTranslation('assistant');
  const boss = agents.find((member) => member.id === agent.reportsToId);
  const team = agents.filter((member) => member.reportsToId === agent.id);

  return (
    <section className={`Workflow_Panel hue-${agent.color}`}>
      <header className='Workflow_Panel_head'>
        <div className='Workflow_Panel_title'>
          <span className='Workflow_Panel_name'>{agent.name}</span>
          <span className='Workflow_Panel_meta'>
            {agent.isRoot ? t('workflow.talksToYou') : t('workflow.reportsTo', { name: boss?.name ?? '—' })}
            {team.length > 0 && ` · ${t('workflow.teamSize', { count: team.length })}`}
          </span>
        </div>
        <div className='Workflow_Tabs' role='tablist'>
          {(['activity', 'config'] as WorkflowTab[]).map((entry) => (
            <button key={entry} type='button' role='tab' aria-selected={tab === entry} className={tab === entry ? 'on' : ''} onClick={() => onTab(entry)}>
              {t(`workflow.tabs.${entry}`)}
            </button>
          ))}
        </div>
      </header>

      {tab === 'activity' ? (
        <Workflow_Activity agents={agents} agentKey={agent.key} />
      ) : (
        <Workflow_Agent_Editor
          key={`${agent.id}-${version}`}
          agent={agent}
          agents={agents}
          tools={tools}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </section>
  );
};

export default Workflow_Agent_Panel;
