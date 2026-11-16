import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Doc_Editor from '../../../Components/Doc_Editor/Doc_Editor';
import { Doc_Link_Chip } from '../../../Components/Doc_Chips/Doc_Chips';
import type { DocProposal } from '../../../Hooks/Docs/docTypes';
import { formatRelativeTime } from '../Apps/relativeTime';

interface Doc_Proposal_Card_Props {
  proposal: DocProposal;
  busy: boolean;
  approveLabel?: string;
  onApprove: (content?: string) => void;
  onReject: () => void;
}

const Doc_Proposal_Card = ({ proposal, busy, approveLabel, onApprove, onReject }: Doc_Proposal_Card_Props) => {
  const { t } = useTranslation('docs');
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(proposal.content);

  const edited = editing && content !== proposal.content;
  const showCurrent = proposal.action === 'EDIT' && proposal.doc;

  const target = () => {
    if (proposal.action === 'CREATE') return t('proposals.newDoc', { title: proposal.title || t('proposals.untitled') });
    if (!proposal.doc) return t('proposals.missingDoc');
    return t('proposals.target', { title: proposal.doc.title });
  };

  const proposedLabel = () => {
    if (proposal.action === 'APPEND') return t('proposals.appended');
    if (proposal.action === 'CREATE') return t('proposals.newContent');
    return t('proposals.proposed');
  };

  const discard = () => {
    setContent(proposal.content);
    setEditing(false);
  };

  return (
    <article className='Doc_Proposal_Card'>
      <header>
        <span className='Doc_Proposal_Agent'>{t('proposals.by', { agent: proposal.proposedBy })}</span>
        <span className={`Doc_Proposal_Action ${proposal.action.toLowerCase()}`}>{t(`proposals.action.${proposal.action}`)}</span>
        <span className='Doc_Proposal_Target'>{target()}</span>
        <span className='Doc_Proposal_Time'>{formatRelativeTime(proposal.createdAt, t)}</span>
      </header>

      {proposal.reason && (
        <p className='Doc_Proposal_Reason'>
          <strong>{t('proposals.reason')}</strong> {proposal.reason}
        </p>
      )}

      {proposal.action === 'CREATE' && Boolean(proposal.kind || proposal.links?.length || proposal.tags.length) && (
        <div className='Doc_Proposal_Links'>
          {proposal.kind && <span className='Doc_Chip kind'>{t(`kinds.${proposal.kind}`)}</span>}
          {proposal.links?.map((link) => (
            <Doc_Link_Chip key={`${link.type}:${link.targetId}`} link={link} />
          ))}
          {proposal.tags.map((tag) => (
            <span key={tag} className='Doc_Chip'>#{tag}</span>
          ))}
        </div>
      )}

      {proposal.replaces.length > 0 && <p className='Doc_Proposal_Replaces'>{t('proposals.replaces', { count: proposal.replaces.length })}</p>}

      <button type='button' className='Doc_Proposal_Toggle' onClick={() => setOpen(!open)} aria-expanded={open || editing}>
        {open || editing ? t('proposals.hideText') : t('proposals.showText')}
      </button>

      {(open || editing) && (
      <div className={`Doc_Proposal_Compare${showCurrent ? ' split' : ''}`}>
        {showCurrent && (
          <div className='Doc_Proposal_Pane'>
            <span className='Doc_Proposal_Pane_Label'>{t('proposals.current')}</span>
            <div className='Doc_Proposal_Pane_Body'>
              <Doc_Editor value={proposal.doc!.content} />
            </div>
          </div>
        )}
        <div className='Doc_Proposal_Pane proposed'>
          <span className='Doc_Proposal_Pane_Label'>{proposedLabel()}</span>
          <div className={`Doc_Proposal_Pane_Body${editing ? ' editing' : ''}`}>
            <Doc_Editor value={content} editable={editing} compact onChange={setContent} />
          </div>
        </div>
      </div>
      )}

      <footer>
        <button type='button' className='Doc_Proposal_Reject' onClick={onReject} disabled={busy}>
          {t('proposals.reject')}
        </button>
        <div className='Doc_Proposal_Right'>
          {editing ? (
            <button type='button' className='Doc_Proposal_Ghost' onClick={discard} disabled={busy}>
              {t('proposals.discardEdits')}
            </button>
          ) : (
            <button type='button' className='Doc_Proposal_Ghost' onClick={() => setEditing(true)} disabled={busy}>
              {t('proposals.editBefore')}
            </button>
          )}
          <button type='button' className='Doc_Proposal_Approve' onClick={() => onApprove(edited ? content : undefined)} disabled={busy}>
            {edited ? t('proposals.approveEdited') : (approveLabel ?? t('proposals.approve'))}
          </button>
        </div>
      </footer>
    </article>
  );
};

export default Doc_Proposal_Card;
