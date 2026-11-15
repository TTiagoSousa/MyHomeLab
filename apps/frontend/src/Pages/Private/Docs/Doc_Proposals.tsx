import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocProposal } from '../../../Hooks/Docs/docTypes';
import * as Icon from '../../../Imports/icons';
import Doc_Proposal_Card from './Doc_Proposal_Card';
import './Doc_Proposals.scss';

interface Doc_Proposals_Props {
  proposals: DocProposal[];
  busyId: string | null;
  onApprove: (id: string, content?: string) => void;
  onReject: (id: string) => void;
}

const Doc_Proposals = ({ proposals, busyId, onApprove, onReject }: Doc_Proposals_Props) => {
  const { t } = useTranslation('docs');
  const [open, setOpen] = useState(true);

  if (proposals.length === 0) return null;

  return (
    <section className='Doc_Proposals'>
      <header>
        <div className='Doc_Proposals_Title'>
          <Icon.Agents />
          <div>
            <span>
              {t('proposals.title')} <em>{t('proposals.count', { count: proposals.length })}</em>
            </span>
            <p>{t('proposals.description')}</p>
          </div>
        </div>
        <button type='button' className='Doc_Proposals_Toggle' onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? t('proposals.hide') : t('proposals.show')}
        </button>
      </header>

      {open && (
        <div className='Doc_Proposals_List'>
          {proposals.map((proposal) => (
            <Doc_Proposal_Card
              key={proposal.id}
              proposal={proposal}
              busy={busyId === proposal.id}
              onApprove={(content) => onApprove(proposal.id, content)}
              onReject={() => onReject(proposal.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default Doc_Proposals;
