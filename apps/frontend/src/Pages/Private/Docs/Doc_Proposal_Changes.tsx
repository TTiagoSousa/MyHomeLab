import { useTranslation } from 'react-i18next';
import type { DocProposalChanges } from '../../../Hooks/Docs/docTypes';

interface Doc_Proposal_Changes_Props {
  changes: DocProposalChanges;
}

const hasChanges = (changes: DocProposalChanges) =>
  Boolean(
    changes.title ||
      changes.section ||
      changes.tagsAdded.length ||
      changes.tagsRemoved.length ||
      changes.linksAdded.length ||
      changes.linksRemoved.length,
  );

const Doc_Proposal_Changes = ({ changes }: Doc_Proposal_Changes_Props) => {
  const { t } = useTranslation('docs');
  if (!hasChanges(changes)) return null;

  const sectionName = (name: string | null) => name ?? t('proposals.changes.noSection');

  return (
    <ul className='Doc_Proposal_Changes'>
      {changes.title && (
        <li>
          <strong>{t('proposals.changes.title')}</strong>
          <span className='removed'>{changes.title.from}</span>→<span className='added'>{changes.title.to}</span>
        </li>
      )}
      {changes.section && (
        <li>
          <strong>{t('proposals.changes.section')}</strong>
          <span className='removed'>{sectionName(changes.section.from)}</span>→
          <span className='added'>
            {sectionName(changes.section.to)}
            {changes.section.isNew && ` ${t('proposals.changes.newSection')}`}
          </span>
        </li>
      )}
      {(changes.linksAdded.length > 0 || changes.linksRemoved.length > 0) && (
        <li>
          <strong>{t('proposals.changes.links')}</strong>
          {changes.linksAdded.map((link) => (
            <span key={`+${link.type}${link.label}`} className='Doc_Chip added'>
              + {link.label}
            </span>
          ))}
          {changes.linksRemoved.map((link) => (
            <span key={`-${link.type}${link.label}`} className='Doc_Chip removed'>
              − {link.label}
            </span>
          ))}
        </li>
      )}
      {(changes.tagsAdded.length > 0 || changes.tagsRemoved.length > 0) && (
        <li>
          <strong>{t('proposals.changes.tags')}</strong>
          {changes.tagsAdded.map((tag) => (
            <span key={`+${tag}`} className='Doc_Chip added'>
              + #{tag}
            </span>
          ))}
          {changes.tagsRemoved.map((tag) => (
            <span key={`-${tag}`} className='Doc_Chip removed'>
              − #{tag}
            </span>
          ))}
        </li>
      )}
    </ul>
  );
};

export default Doc_Proposal_Changes;
