import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Agents_Workflow.scss';
import { useAgents, type Agent } from '../../../../Hooks/Agent/useAgents';
import { useAgentTools } from '../../../../Hooks/Agent/useAgentTools';
import Workflow_Agent_List from './Workflow_Agent_List';
import Workflow_Activity from './Workflow_Activity';
import Workflow_Agent_Panel, { type WorkflowTab } from './Workflow_Agent_Panel';
import Workflow_Agent_Editor from './Workflow_Agent_Editor';

const Agents_Workflow = () => {
  const { t } = useTranslation('assistant');
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkflowTab>('activity');
  const [version, setVersion] = useState(0);
  const { agents, live, error, setAgents } = useAgents();
  const { tools } = useAgentTools();

  const agent = agents.find((entry) => entry.id === selected) ?? null;

  const select = (id: string | null) => {
    setSelected(id);
    setTab('activity');
  };

  const saved = (team: Agent[]) => {
    const created = team.find((entry) => !agents.some((current) => current.id === entry.id));
    setAgents(team);
    setVersion((current) => current + 1);
    if (created) {
      setSelected(created.id);
      setTab('config');
    }
  };

  const deleted = (team: Agent[]) => {
    setAgents(team);
    select(null);
  };

  return (
    <div className='Agents_Workflow'>
      <header>
        <div className='Right_Side'>
          <span>{t('workflow.title')}</span>
        </div>
        <span className={`Agents_Workflow_live${live ? ' on' : ''}`}>
          {live ? t('header.connected') : t('header.down')}
        </span>
      </header>

      {error && <p className='Agents_Workflow_error'>{error}</p>}

      <div className='Agents_Workflow_layout'>
        <Workflow_Agent_List agents={agents} selected={selected} onSelect={select} onCreate={() => setSelected('new')} />

        {selected === 'new' && (
          <section className='Workflow_Panel'>
            <header className='Workflow_Panel_head'>
              <div className='Workflow_Panel_title'>
                <span className='Workflow_Panel_name'>{t('workflow.newAgent')}</span>
                <span className='Workflow_Panel_meta'>{t('workflow.newAgentHint')}</span>
              </div>
            </header>
            <Workflow_Agent_Editor agent={null} agents={agents} tools={tools} onSaved={saved} onDeleted={deleted} />
          </section>
        )}

        {agent && (
          <Workflow_Agent_Panel
            agent={agent}
            agents={agents}
            tools={tools}
            tab={tab}
            version={version}
            onTab={setTab}
            onSaved={saved}
            onDeleted={deleted}
          />
        )}

        {selected === null && <Workflow_Activity agents={agents} agentKey={null} />}
      </div>
    </div>
  );
};

export default Agents_Workflow;
