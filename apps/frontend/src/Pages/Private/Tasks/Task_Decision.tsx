import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDocProposals } from '../../../Hooks/Docs/useDocProposals';
import Doc_Proposal_Card from '../Docs/Doc_Proposal_Card';
import type { BoardState, TaskDetail } from '../../../Hooks/Board/boardTypes';
import '../Docs/Doc_Proposals.scss';

interface Task_Decision_Props {
  task: TaskDetail;
  states: BoardState[];
  saving: boolean;
  onMove: (stateId: string) => Promise<boolean>;
  onChanged: () => void;
}

const Task_Decision = ({ task, states, saving, onMove, onChanged }: Task_Decision_Props) => {
  const { t } = useTranslation('tasks');
  const navigate = useNavigate();
  const { proposals, busyId, approveProposal, rejectProposal } = useDocProposals();

  const update = task.update;
  const waiting = update?.status === 'WAITING';
  const own = proposals.filter((proposal) => proposal.taskId === task.id);

  const move = (key: string) => {
    const state = states.find((item) => item.key === key);
    if (state) void onMove(state.id);
  };

  const approve = async (proposalId: string, content?: string) => {
    if (!(await approveProposal(proposalId, content))) return;
    if (waiting && own.length === 1) move('ready');
    else onChanged();
  };

  const reject = async (proposalId: string) => {
    if (await rejectProposal(proposalId)) onChanged();
  };

  return (
    <>
      {own.map((proposal) => (
        <section key={proposal.id} className='Task_Decision'>
          <span className='Task_Decision_Label'>{t('decision.proposal')}</span>
          <Doc_Proposal_Card
            proposal={proposal}
            busy={saving || busyId === proposal.id}
            approveLabel={waiting && own.length === 1 ? t('decision.approveAndInstall') : undefined}
            onApprove={(content) => void approve(proposal.id, content)}
            onReject={() => void reject(proposal.id)}
          />
        </section>
      ))}

      {update && waiting && own.length === 0 && (
        <section className='Task_Decision'>
          <span className='Task_Decision_Label'>{t('decision.asks')}</span>
          <p>{update.question ?? t('decision.noQuestion')}</p>
          <div className='Task_Decision_Actions'>
            <button type='button' className='primary' disabled={saving} onClick={() => move('ready')}>
              {t('decision.install')}
            </button>
            <button type='button' disabled={saving} onClick={() => move('later')}>
              {t('decision.later')}
            </button>
            <button type='button' className='danger' disabled={saving} onClick={() => move('cancelled')}>
              {t('decision.cancel')}
            </button>
          </div>
          <span className='Task_Decision_Hint'>{t('decision.hint')}</span>
        </section>
      )}

      {update && (
        <div className='Task_Update_Box'>
          <span>{t('detail.update', { from: update.fromVersion, to: update.toVersion })}</span>
          {update.logDocId && (
            <button type='button' className='Tasks_Ghost' onClick={() => navigate(`/MyHomeLab/Docs/${update.logDocId}`)}>
              {t('detail.openLog')}
            </button>
          )}
        </div>
      )}
    </>
  );
};

export default Task_Decision;
