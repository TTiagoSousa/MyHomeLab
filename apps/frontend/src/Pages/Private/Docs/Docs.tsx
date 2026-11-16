import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDocs } from '../../../Hooks/Docs/useDocs';
import { useDoc } from '../../../Hooks/Docs/useDoc';
import { useDocProposals } from '../../../Hooks/Docs/useDocProposals';
import { useDocTargets } from '../../../Hooks/Docs/useDocTargets';
import { ATTEMPT_KIND, type DocKind, type DocLinkType, type DocTarget } from '../../../Hooks/Docs/docTypes';
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
import Docs_Groups from './Docs_Groups';
import Docs_Starter_Modal from './Docs_Starter_Modal';
import { useDocTemplates } from '../../../Hooks/Docs/useDocTemplates';
import { draftToPayload, emptyDraft, kindFromQuery, linkFromQuery, type DocDraft } from './docDraft';
import './Docs.scss';

const SEARCH_DELAY_MS = 300;
const DOCS_PATH = '/MyHomeLab/Docs';
const NEW_DOC_PARAMS = ['linkType', 'targetId', 'label', 'newKind'];
const HISTORY_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const FILTER_PARAMS = ['q', 'kind', 'link', 'target', 'targetLabel', 'author', 'sort'];
const HISTORY_VIEW = 'history';

const Docs = () => {
  const { t } = useTranslation('docs');
  const { docId, attemptId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const history = searchParams.get('view') === HISTORY_VIEW;
  const [olderShown, setOlderShown] = useState(false);
  const [historyFrom] = useState(() => Date.now() - HISTORY_DAYS * DAY_MS);
  const [choosingStarter, setChoosingStarter] = useState(false);
  const kind = searchParams.get('kind') ?? '';
  const linkType = (searchParams.get('link') ?? '') as DocLinkType | '';
  const targetId = linkType ? (searchParams.get('target') ?? '') : '';
  const targetLabel = searchParams.get('targetLabel') ?? '';
  const author = (searchParams.get('author') ?? '') as DocsFilterValues['author'];
  const sort = (searchParams.get('sort') === 'title' ? 'title' : 'recent') as DocsFilterValues['sort'];
  const [searchText, setSearchText] = useState(search);
  const [creatingDoc, setCreatingDoc] = useState(false);

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

  const setView = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.delete('kind');
    if (value) next.set('view', value);
    else next.delete('view');
    setSearchParams(next, { replace: true });
  };

  const filterQuery = () => {
    const filters = new URLSearchParams();
    ['view', ...FILTER_PARAMS].forEach((param) => {
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

  const docKind = (history ? (kind === ATTEMPT_KIND ? '' : 'LOG') : kind) as DocKind | '';
  const { docs, loading, error, creatingStarter, fetchDocs, createDoc, createStarterDocs, createFromTemplate } = useDocs({ search, kind: docKind, linkType, targetId, owner: author, sort });
  const { targets } = useDocTargets();
  const { sets, loading: loadingSets, fetchSets } = useDocTemplates();

  const openStarter = () => {
    setChoosingStarter(true);
    void fetchSets();
  };

  const chooseStarter = async (id: string | null) => {
    if (id) await createFromTemplate(id);
    else await createStarterDocs();
    setChoosingStarter(false);
  };
  const { attempts } = useUpdateAttempts(linkType === 'APP' && targetId ? targetId : undefined);
  const docState = useDoc(docId);
  const { proposals, busyId, approveProposal, rejectProposal } = useDocProposals();

  const libraryDocs = docs.filter((doc) => doc.kind !== 'LOG');
  const showDocs = history && kind !== ATTEMPT_KIND;
  const showAttempts = history && (!kind || kind === ATTEMPT_KIND) && (!linkType || linkType === 'APP') && author !== 'USER';
  const shownDocs = showDocs ? docs : [];
  const shownAttempts = showAttempts
    ? attempts.filter((attempt) => !search || attempt.title.toLowerCase().includes(search.toLowerCase()))
    : [];
  const allItems = [
    ...shownDocs.map((doc) => ({ key: doc.id, title: doc.title, date: doc.updatedAt, doc, attempt: null })),
    ...shownAttempts.map((attempt) => ({ key: attempt.id, title: attempt.title, date: attempt.updatedAt, doc: null, attempt })),
  ].sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title) : new Date(b.date).getTime() - new Date(a.date).getTime()));
  const items = olderShown ? allItems : allItems.filter((item) => new Date(item.date).getTime() >= historyFrom);
  const olderCount = allItems.length - items.length;

  const creating = !docId && searchParams.get('new') === '1';
  const onPage = Boolean(docId || attemptId) || creating;
  const filtering = Boolean(search || kind || linkType || author || history);
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

  const openNewFor = (target: DocTarget, newKind: DocKind) => {
    const params = new URLSearchParams({ new: '1', linkType: target.type, targetId: target.targetId, label: target.label, newKind });
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

  const renderPage = () => {
    if (creating) {
      return (
        <Doc_Form
          key={NEW_DOC_PARAMS.map((name) => searchParams.get(name) ?? '').join('|')}
          heading={t('form.newTitle')}
          initial={emptyDraft(linkFromQuery(searchParams), kindFromQuery(searchParams))}
          saving={creatingDoc}
          onSave={create}
          onCancel={cancelCreate}
        />
      );
    }
    if (attemptId) return <Attempt_Detail key={attemptId} attemptId={attemptId} />;
    return <Doc_Detail key={docId} docId={docId!} docState={docState} onChanged={fetchDocs} onDeleted={handleDeleted} />;
  };

  const shownCount = history ? allItems.length : libraryDocs.length;

  const renderList = () => {
    if (loading) return <p className='Docs_list_note'>{t('list.loading')}</p>;
    if (error) return <p className='Docs_list_note error'>{error}</p>;
    if (shownCount === 0) return <p className='Docs_list_note'>{t(history ? 'list.noHistory' : 'list.noResults')}</p>;
    if (!history) {
      return <Docs_Groups docs={libraryDocs} targets={targets} showMissing={!search && !kind && !linkType && !author} onSelect={openDoc} onCreate={openNewFor} />;
    }
    const rows = items.map((item) =>
      item.attempt ? (
        <Attempt_List_Item key={item.key} attempt={item.attempt} onSelect={() => openAttempt(item.key)} />
      ) : (
        <Doc_List_Item key={item.key} doc={item.doc!} onSelect={() => openDoc(item.key)} />
      ),
    );
    return (
      <>
        {rows}
        {olderCount > 0 && (
          <button type='button' className='Docs_older' onClick={() => setOlderShown(true)}>
            {t('list.showOlder', { count: olderCount, days: HISTORY_DAYS })}
          </button>
        )}
      </>
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
          <button type='button' className='Docs_starter' onClick={openStarter} disabled={creatingStarter}>
            {creatingStarter ? t('actions.starterBusy') : t('actions.starter')}
          </button>
          <button type='button' className='Docs_new' onClick={openNew}>
            <Icon.Plus />
            <span>{targetId ? t('actions.newLinked', { label: targetLabel || targetId }) : t('actions.new')}</span>
          </button>
        </div>
      </header>

      <Doc_Proposals proposals={proposals} busyId={busyId} onApprove={approve} onReject={rejectProposal} />

      <nav className='Docs_Sections' aria-label={t('title')}>
        <button type='button' aria-current={!history ? 'page' : undefined} className={!history ? 'active' : ''} onClick={() => setView('')}>
          <Icon.Doc />
          {t('sections.library')}
        </button>
        <button type='button' aria-current={history ? 'page' : undefined} className={history ? 'active' : ''} onClick={() => setView(HISTORY_VIEW)}>
          <Icon.Clock />
          {t('sections.history')}
        </button>
      </nav>

      {isEmpty ? (
        <Docs_Empty creatingStarter={creatingStarter} onStarter={openStarter} onNew={openNew} />
      ) : (
        <>
          <Docs_Filters
            values={{ search: searchText, kind, linkType, targetId, author, sort }}
            history={history}
            targets={targets}
            onSearch={setSearchText}
            onChange={setFilter}
            onTarget={setTarget}
            onClear={clearFilters}
          />
          <section className='Docs_list_pane'>
            {!loading && !error && <span className='Docs_count'>{t(history ? 'list.historyCount' : 'list.count', { count: shownCount })}</span>}
            <div className='Docs_list'>{renderList()}</div>
          </section>
        </>
      )}


      {choosingStarter && (
        <Docs_Starter_Modal
          sets={sets}
          loading={loadingSets}
          busy={creatingStarter}
          onGeneric={() => void chooseStarter(null)}
          onSet={(id) => void chooseStarter(id)}
          onClose={() => setChoosingStarter(false)}
        />
      )}
    </div>
  );
};

export default Docs;
