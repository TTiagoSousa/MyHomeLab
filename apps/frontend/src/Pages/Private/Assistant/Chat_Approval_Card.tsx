import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatApproval } from '../../../Hooks/Assistant/chatApprovalTypes';
import { formatRelativeTime } from '../Apps/relativeTime';

interface Chat_Approval_Card_Props {
  approval: ChatApproval;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}

const Chat_Approval_Card = ({ approval, busy, onApprove, onReject }: Chat_Approval_Card_Props) => {
  const { t } = useTranslation('assistant');
  const [open, setOpen] = useState(false);

  const toolName = (name: string) => t(`workflow.toolNames.${name}`, { defaultValue: name });

  const title = () => {
    if (approval.kind === 'EMAIL_SEND') return approval.payload.subject;
    if (approval.kind === 'AGENT_CHANGE') return approval.payload.agentName;
    return approval.payload.label;
  };

  const action = approval.kind === 'AGENT_CHANGE' ? `${approval.kind}.${approval.payload.action}` : approval.kind;

  return (
    <article className='Doc_Proposal_Card Chat_Approval_Card'>
      <header>
        <span className='Doc_Proposal_Agent'>{t('approvals.by', { agent: approval.proposedBy })}</span>
        <span className='Doc_Proposal_Action'>{t(`approvals.action.${action}`)}</span>
        <span className='Doc_Proposal_Target'>{title()}</span>
        <span className='Doc_Proposal_Time'>{formatRelativeTime(approval.createdAt, t)}</span>
      </header>

      {approval.kind === 'EMAIL_SEND' && (
        <dl className='Chat_Approval_Fields'>
          <dt>{t('approvals.email.to')}</dt>
          <dd>{approval.payload.to}</dd>
          {approval.payload.cc && (
            <>
              <dt>{t('approvals.email.cc')}</dt>
              <dd>{approval.payload.cc}</dd>
            </>
          )}
          <dt>{t('approvals.email.subject')}</dt>
          <dd>{approval.payload.subject}</dd>
          {approval.payload.attachments.length > 0 && (
            <>
              <dt>{t('approvals.email.attachments')}</dt>
              <dd>{approval.payload.attachments.join(', ')}</dd>
            </>
          )}
        </dl>
      )}

      {approval.kind === 'EMAIL_SEND' && approval.payload.newRecipients.length > 0 && (
        <p className='Chat_Approval_Warning'>
          {t('approvals.email.newRecipient', { addresses: approval.payload.newRecipients.join(', ') })}
        </p>
      )}

      {approval.kind === 'EMAIL_SEND' && <p className='Chat_Approval_Text'>{approval.payload.text}</p>}

      {approval.kind === 'AGENT_CHANGE' && approval.payload.addedTools.length > 0 && (
        <div className='Chat_Approval_Tools'>
          <span className='Chat_Approval_Label'>{t('approvals.agent.addedTools')}</span>
          <ul>
            {approval.payload.addedTools.map((tool) => (
              <li key={tool.name} className={tool.write ? 'write' : undefined}>
                <span>+ {toolName(tool.name)}</span>
                {tool.write && <em>{t('approvals.agent.writes')}</em>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {approval.kind === 'AGENT_CHANGE' && approval.payload.removedTools.length > 0 && (
        <div className='Chat_Approval_Tools'>
          <span className='Chat_Approval_Label'>{t('approvals.agent.removedTools')}</span>
          <ul>
            {approval.payload.removedTools.map((name) => (
              <li key={name}>− {toolName(name)}</li>
            ))}
          </ul>
        </div>
      )}

      {approval.kind === 'AGENT_CHANGE' && approval.payload.changes.length > 0 && (
        <dl className='Chat_Approval_Fields'>
          {approval.payload.changes.map((change) => (
            <div key={change.field} className='Chat_Approval_Change'>
              <dt>{t(`approvals.agent.fields.${change.field}`)}</dt>
              <dd>
                {change.before !== null && <s>{change.before}</s>}
                {change.before !== null && ' → '}
                {change.after ?? '—'}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {approval.kind === 'AGENT_CHANGE' && approval.payload.promptAfter != null && (
        <>
          <button type='button' className='Doc_Proposal_Toggle' onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? t('approvals.agent.hidePrompt') : t('approvals.agent.showPrompt')}
          </button>
          {open && (
            <div className={`Chat_Approval_Prompts${approval.payload.promptBefore != null ? ' split' : ''}`}>
              {approval.payload.promptBefore != null && (
                <div>
                  <span className='Chat_Approval_Label'>{t('approvals.agent.promptBefore')}</span>
                  <pre>{approval.payload.promptBefore || t('approvals.agent.siteDefault')}</pre>
                </div>
              )}
              <div>
                <span className='Chat_Approval_Label'>{t('approvals.agent.promptAfter')}</span>
                <pre>{approval.payload.promptAfter || t('approvals.agent.siteDefault')}</pre>
              </div>
            </div>
          )}
        </>
      )}

      {approval.kind === 'AGENT_CHANGE' && approval.payload.action === 'delete' && (
        <p className='Chat_Approval_Warning'>{t('approvals.agent.deleteWarning')}</p>
      )}

      {approval.kind === 'UPDATE_INSTALL' && <p className='Chat_Approval_Text'>{approval.payload.comment}</p>}

      <footer>
        <button type='button' className='Doc_Proposal_Reject' onClick={onReject} disabled={busy}>
          {t('approvals.reject')}
        </button>
        <div className='Doc_Proposal_Right'>
          <button type='button' className='Doc_Proposal_Approve' onClick={onApprove} disabled={busy}>
            {t(`approvals.approve.${approval.kind}`)}
          </button>
        </div>
      </footer>
    </article>
  );
};

export default Chat_Approval_Card;
