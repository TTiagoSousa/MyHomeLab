import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Apps_Section } from '../../Pages/Private/Apps/appsShared';
import { Doc_Meta_Chips } from '../Doc_Chips/Doc_Chips';
import { useLinkedDocs } from '../../Hooks/Docs/useLinkedDocs';
import type { DocLinkType } from '../../Hooks/Docs/docTypes';
import * as Icon from '../../Imports/icons';
import './Linked_Docs.scss';

const PAGE_SIZE = 5;

interface Linked_Docs_Props {
  type: DocLinkType;
  targetId: string;
  label: string;
}

const Linked_Docs = ({ type, targetId, label }: Linked_Docs_Props) => {
  const { t } = useTranslation('docs');
  const navigate = useNavigate();
  const { docs, loading, error } = useLinkedDocs(type, targetId);
  const [page, setPage] = useState(0);

  const pages = Math.max(1, Math.ceil(docs.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = docs.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const createLinked = () => {
    const params = new URLSearchParams({ new: '1', linkType: type, targetId, label });
    navigate(`/MyHomeLab/Docs?${params.toString()}`);
  };

  const openAll = () => {
    const params = new URLSearchParams({ link: type, target: targetId, targetLabel: label });
    navigate(`/MyHomeLab/Docs?${params.toString()}`);
  };

  return (
    <Apps_Section
      icon={<Icon.Doc />}
      title={t('linked.title')}
      description={t('linked.description', { label })}
    >
      <div className='Linked_Docs'>
        {loading && <p className='Linked_Docs_Note'>{t('linked.loading')}</p>}
        {!loading && error && <p className='Linked_Docs_Note error'>{error}</p>}
        {!loading && !error && docs.length === 0 && <p className='Linked_Docs_Note'>{t('linked.empty')}</p>}

        {visible.map((doc) => (
          <button key={doc.id} type='button' className='Linked_Docs_Item' onClick={() => navigate(`/MyHomeLab/Docs/${doc.id}`)}>
            <span className='Linked_Docs_Title'>{doc.title}</span>
            <span className='Linked_Docs_Chips'>
              <Doc_Meta_Chips kind={doc.kind} owner={doc.owner} />
            </span>
            {doc.summary && <span className='Linked_Docs_Summary'>{doc.summary}</span>}
          </button>
        ))}

        {docs.length > PAGE_SIZE && (
          <div className='Linked_Docs_Pager'>
            <button type='button' className='prev' onClick={() => setPage(current - 1)} disabled={current === 0} aria-label={t('linked.previous')}>
              <Icon.Chevron />
            </button>
            <span>{t('linked.page', { page: current + 1, pages })}</span>
            <button type='button' onClick={() => setPage(current + 1)} disabled={current === pages - 1} aria-label={t('linked.next')}>
              <Icon.Chevron />
            </button>
            <button type='button' className='Linked_Docs_All' onClick={openAll}>
              {t('linked.all', { count: docs.length })}
            </button>
          </div>
        )}

        <button type='button' className='Linked_Docs_New' onClick={createLinked}>
          <Icon.Plus />
          <span>{t('linked.new')}</span>
        </button>
      </div>
    </Apps_Section>
  );
};

export default Linked_Docs;
