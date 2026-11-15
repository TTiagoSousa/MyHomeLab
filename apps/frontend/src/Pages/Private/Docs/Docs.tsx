import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDocs } from '../../../Hooks/Docs/useDocs';
import { useDoc } from '../../../Hooks/Docs/useDoc';
import { useDocProposals } from '../../../Hooks/Docs/useDocProposals';
import { useDocTypes } from '../../../Hooks/Docs/useDocTypes';
import { useDocTargets } from '../../../Hooks/Docs/useDocTargets';
import { ATTEMPT_KIND, TYPE_PREFIX, type DocKind, type DocLinkType, type DocTarget } from '../../../Hooks/Docs/docTypes';
import { useUpdateAttempts } from '../../../Hooks/Updates/useUpdateAttempts';
import Attempt_List_Item from './Attempt_List_Item';
import Attempt_Detail from './Attempt_Detail';
import * as Icon from '../../../Imports/icons';
import Page_Help from '../../../Components/Page_Help/Page_Help';
import Docs_Filters, { type DocsFilterValues } from './Docs_Filters';
import Docs_Empty from './Docs_Empty';
import Doc_List_Item from './Doc_List_Item';
import Doc_Detail from './Doc_Detail';
import Doc_Form from './Doc_Form';
import Doc_Proposals from './Doc_Proposals';
import Doc_Types_Modal from './Doc_Types_Modal';
import { draftToPayload, emptyDraft, linkFromQuery, type DocDraft } from './docDraft';
import './Docs.scss';

const SEARCH_DELAY_MS = 300;
const DOCS_PATH = '/MyHomeLab/Docs';
const NEW_DOC_PARAMS = ['linkType', 'targetId', 'label'];
const FILTER_PARAMS = ['q', 'kind', 'link', 'target', 'targetLabel', 'required', 'author', 'sort'];

const Docs = () => {
  const { t } = useTranslation('docs');
  const { docId, attemptId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const kind = searchParams.get('kind') ?? '';
  const linkType = (searchParams.get('link') ?? '') as DocLinkType | '';
  const targetId = linkType ? (searchParams.get('target') ?? '') : '';
  const targetLabel = searchParams.get('targetLabel') ?? '';
  const requiredOnly = searchParams.get('required') === '1';
  const author = (searchParams.get('author') ?? '') as DocsFilterValues['author'];
  const sort = (searchParams.get('sort') === 'title' ? 'title' : 'recent') as DocsFilterValues['sort'];
  const [searchText, setSearchText] = useState(search);
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [managingTypes, setManagingTypes] = useState(false);

  const setFilter = (name: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name === 'link') {
      next.delete('target');
      next.delete('targetLabel');
    }
    setSearchParams(next, { replace: true });
  };

  const setTarget = (target: DocTarget | null) => {
    const next = new URLSearchParams(searchParams);
    if (target) {
      next.set('target', target.targetId);
      next.set('targetLabel', target.label);
    } else {
      next.delete('target');
      next.delete('targetLabel');
    }
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    FILTER_PARAMS.forEach((param) => next.delete(param));
    setSearchText('');
    setSearchParams(next, { replace: true });
  };

  const filterQuery = () => {
    const filters = new URLSearchParams();
    FILTER_PARAMS.forEach((param) => {
      const value = searchParams.get(param);
      if (value) filters.set(param, value);
    });
    const text = filters.toString();
    return text ? `?${text}` : '';
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText.trim() !== search) setFilter('q', searchText.trim());
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const typeId = kind.startsWith(TYPE_PREFIX) ? kind.slice(TYPE_PREFIX.length) : '';
  const docKind = (kind === ATTEMPT_KIND || typeId ? '' : kind) as DocKind | '';
  const { docs, loading, error, creatingStarter, fetchDocs, createDoc, createStarterDocs } = useDocs({ search, kind: docKind, typeId, linkType, targetId, required: requiredOnly, owner: author, sort });
  const { types, saving: savingType, fetchTypes, createType, deleteType } = useDocTypes();
  const { targets } = useDocTargets();
  const { attempts } = useUpdateAttempts(linkType === 'APP' && targetId ? targetId : undefined);
  const docState = useDoc(docId);
  const { proposals, busyId, approveProposal, rejectProposal } = useDocProposals();

  const showDocs = kind !== ATTEMPT_KIND;
  const showAttempts = (!kind || kind === ATTEMPT_KIND) && (!linkType || linkType === 'APP') && !requiredOnly && author !== 'USER';
  const shownDocs = showDocs ? docs : [];
  const shownAttempts = showAttempts
    ? attempts.filter((attempt) => !search || attempt.title.toLowerCase().includes(search.toLowerCase()))
    : [];
  const items = [
    ...shownDocs.map((doc) => ({ key: doc.id, title: doc.title, date: doc.updatedAt, doc, attempt: null })),
    ...shownAttempts.map((attempt) => ({ key: attempt.id, title: attempt.title, date: attempt.updatedAt, doc: null, attempt })),
  ].sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title) : new Date(b.date).getTime() - new Date(a.date).getTime()));
  const typeName = (id: string | null) => types.find((type) => type.id === id)?.name;

  const creating = !docId && searchParams.get('new') === '1';
  const onPage = Boolean(docId || attemptId) || creating;
  const filtering = Boolean(search || kind || linkType || requiredOnly || author);
  const isEmpty = !loading && !error && docs.length === 0 && attempts.length === 0 && !filtering;

  const openDoc = (id: string) => navigate(`${DOCS_PATH}/${id}${filterQuery()}`);
  const openAttempt = (id: string) => navigate(`${DOCS_PATH}/attempts/${id}${filterQuery()}`);
  const backToList = () => navigate(`${DOCS_PATH}${filterQuery()}`);

  const openNew = () => {
    const params = new URLSearchParams({ new: '1' });
    if (linkType && targetId) {
      params.set('linkType', linkType);
      params.set('targetId', targetId);
      params.set('label', targetLabel || targetId);
    }
    navigate(`${DOCS_PATH}?${params.toString()}`);
  };

  const cancelCreate = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else backToList();
  };

  const create = async (draft: DocDraft) => {
    setCreatingDoc(true);
    const doc = await createDoc(draftToPayload(draft));
    setCreatingDoc(false);
    if (doc) navigate(`${DOCS_PATH}/${doc.id}`, { replace: true });
  };

  const approve = async (id: string, content?: string) => {
    const doc = await approveProposal(id, content);
    if (!doc) return;
    await fetchDocs();
    if (doc.id === docId) await docState.fetchDoc();
    else openDoc(doc.id);
  };

  const handleDeleted = async () => {
    await fetchDocs();
    backToList();
  };

  const removeType = async (id: string) => {
    const removed = await deleteType(id);
    if (removed && typeId === id) setFilter('kind', '');
    if (removed) await fetchDocs();
  };

  const renderPage = () => {
    if (creating) {
      return (
        <Doc_Form
          key={NEW_DOC_PARAMS.map((name) => searchParams.get(name) ?? '').join('|')}
          heading={t('form.newTitle')}
          initial={emptyDraft(linkFromQuery(searchParams))}
          saving={creatingDoc}
          onSave={create}
          onCancel={cancelCreate}
        />
      );
    }
    if (attemptId) return <Attempt_Detail key={attemptId} attemptId={attemptId} />;
    return <Doc_Detail key={docId} docId={docId!} docState={docState} onChanged={fetchDocs} onDeleted={handleDeleted} />;
  };

  const renderList = () => {
    if (loading) return <p className='Docs_list_note'>{t('list.loading')}</p>;
    if (error) return <p className='Docs_list_note error'>{error}</p>;
    if (items.length === 0) return <p className='Docs_list_note'>{t('list.noResults')}</p>;
    return items.map((item) =>
      item.attempt ? (
        <Attempt_List_Item key={item.key} attempt={item.attempt} onSelect={() => openAttempt(item.key)} />
      ) : (
        <Doc_List_Item key={item.key} doc={item.doc!} typeName={typeName(item.doc!.typeId)} onSelect={() => openDoc(item.key)} />
      ),
    );
  };

  if (onPage) {
    return (
      <div className='Docs on_page'>
        <header>
          <div className='Right_Side'>
            <button type='button' className='Docs_back' onClick={backToList}>
              <Icon.Chevron />
              <span>{t('actions.back')}</span>
            </button>
          </div>
        </header>
        <section className='Docs_page'>{renderPage()}</section>
      </div>
    );
  }

  return (
    <div className='Docs'>
      <header>
        <div className='Right_Side'>
          <span>{t('title')}</span>
          <Page_Help topic='docs' />
        </div>
        <div className='Left_Side'>
          <button type='button' className='Docs_starter' onClick={createStarterDocs} disabled={creatingStarter}>
            {creatingStarter ? t('actions.starterBusy') : t('actions.starter')}
          </button>
          <button type='button' className='Docs_new' onClick={openNew}>
            <Icon.Plus />
            <span>{targetId ? t('actions.newLinked', { label: targetLabel || targetId }) : t('actions.new')}</span>
          </button>
        </div>
      </header>

      <Doc_Proposals proposals={proposals} busyId={busyId} onApprove={approve} onReject={rejectProposal} />

      {isEmpty ? (
        <Docs_Empty creatingStarter={creatingStarter} onStarter={createStarterDocs} onNew={openNew} />
      ) : (
        <>
          <Docs_Filters
            values={{ search: searchText, kind, linkType, targetId, required: requiredOnly, author, sort }}
            types={types}
            targets={targets}
            onSearch={setSearchText}
            onChange={setFilter}
            onTarget={setTarget}
            onClear={clearFilters}
            onManageTypes={() => setManagingTypes(true)}
          />
          <section className='Docs_list_pane'>
            {!loading && !error && <span className='Docs_count'>{t('list.count', { count: items.length })}</span>}
            <div className='Docs_list'>{renderList()}</div>
          </section>
        </>
      )}

      {managingTypes && (
        <Doc_Types_Modal
          types={types}
          saving={savingType}
          onCreate={createType}
          onDelete={removeType}
          onClose={() => {
            setManagingTypes(false);
            void fetchTypes();
          }}
        />
      )}
    </div>
  );
};

export default Docs;
