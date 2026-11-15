import type { Agent } from '../../../../Hooks/Agent/useAgents';
import { useAgentLogs } from '../../../../Hooks/Agent/useAgentLogs';
import Workflow_Console from './Workflow_Console';

interface Workflow_Activity_Props {
  agents: Agent[];
  agentKey: string | null;
}

const Workflow_Activity = ({ agents, agentKey }: Workflow_Activity_Props) => {
  const { logs, loading, hasOlder, error, fetchOlder } = useAgentLogs(agentKey);

  return (
    <div className='Workflow_Activity'>
      {error && <p className='Agents_Workflow_error'>{error}</p>}
      <Workflow_Console agents={agents} logs={logs} loading={loading} hasOlder={hasOlder} onOlder={fetchOlder} />
    </div>
  );
};

export default Workflow_Activity;
