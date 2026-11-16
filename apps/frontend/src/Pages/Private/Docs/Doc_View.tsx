import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Doc_Editor from '../../../Components/Doc_Editor/Doc_Editor';
import { Doc_Link_Chip, Doc_Meta_Chips } from '../../../Components/Doc_Chips/Doc_Chips';
import type { Doc } from '../../../Hooks/Docs/docTypes';
import * as Icon from '../../../Imports/icons';
import { formatRelativeTime } from '../Apps/relativeTime';
import { authorLabel } from './docFormat';
import './Doc_View.scss';

interface Doc_View_Props {
  doc: Doc;
  onEdit: () => void;
  versionsOpen: boolean;
  onToggleVersions: () => void;
  checking: boolean;
  onCheckConflicts: () => void;
  children?: ReactNode;
}

const Doc_View = ({ doc, onEdit, versionsOpen, onToggleVersions, checking, onCheckConflicts, children }: Doc_View_Props) => {
  const navigate = useNavigate();
  const { t } = useTranslation('docs');
  const versionCount = doc.versions?.length ?? 0;

  return (
    <article className='Doc_View'>
      <header className='Doc_View_Head'>
        <div className='Doc_View_Title'>
          <h1>{doc.title}</h1>
          <div className='Doc_View_Chips'>
            <Doc_Meta_Chips kind={doc.kind} owner={doc.owner} />
          </div>
        </div>
        <div className='Doc_View_Actions'>
          {doc.kind === 'RULES' && (
            <button type='button' className='Doc_View_Ghost' onClick={onCheckConflicts} disabled={checking} title={t('conflicts.checkHint')}>
              {checking ? t('conflicts.checking') : t('conflicts.check')}
            </button>
          )}
          <button type='button' className='Doc_View_Ghost' onClick={onToggleVersions} aria-expanded={versionsOpen}>
            {versionsOpen ? t('versions.hide') : t('versions.show', { count: versionCount })}
          </button>
          <button type='button' className='Doc_View_Edit' onClick={onEdit}>
            <Icon.Pencil />
            <span>{t('actions.edit')}</span>
          </button>
        </div>
      </header>

      <span className='Doc_View_Meta'>
        {t('detail.updated', { time: formatRelativeTime(doc.updatedAt, t), by: authorLabel(doc.updatedBy, t) })}
        {doc.owner === 'AGENT' && ` · ${t('detail.agentDoc')}`}
      </span>

      {doc.conflicts && doc.conflicts.length > 0 && (
        <div className='Doc_View_Conflicts'>
          <strong>{t('conflicts.title')}</strong>
          {doc.conflicts.map((conflict) => (
            <p key={conflict.docId + conflict.text}>
              <button type='button' onClick={() => navigate(`/MyHomeLab/Docs/${conflict.docId}`)}>
                {conflict.title}
              </button>
              {conflict.text}
            </p>
          ))}
        </div>
      )}

      {doc.summary && <p className='Doc_View_Summary'>{doc.summary}</p>}

      <dl className='Doc_View_Facts'>
        <dt>{t('detail.links')}</dt>
        <dd>
          {doc.links.length === 0 ? (
            <span className='Doc_View_None'>{t('detail.noLinks')}</span>
          ) : (
            doc.links.map((link) => <Doc_Link_Chip key={link.id} link={link} />)
          )}
        </dd>
        {doc.tags.length > 0 && (
          <>
            <dt>{t('detail.tags')}</dt>
            <dd>
              {doc.tags.map((tag) => (
                <span key={tag} className='Doc_View_Tag'>
                  #{tag}
                </span>
              ))}
            </dd>
          </>
        )}
      </dl>

      {children}

      <div className='Doc_View_Body'>
        {doc.content.trim() ? (
          <Doc_Editor value={doc.content} />
        ) : (
          <p className='Doc_View_None'>{t('detail.noContent')}</p>
        )}
      </div>
    </article>
  );
};

export default Doc_View;
