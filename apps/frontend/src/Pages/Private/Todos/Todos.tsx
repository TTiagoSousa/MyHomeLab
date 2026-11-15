import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useTodoLists } from '../../../Hooks/Todos/useTodoLists';
import { useTodos } from '../../../Hooks/Todos/useTodos';
import { useTodoSync } from '../../../Hooks/Todos/useTodoSync';
import { TODO_VIEWS, isOpenTodo, type Todo, type TodoPayload, type TodoView } from '../../../Hooks/Todos/todoTypes';
import * as Icon from '../../../Imports/icons';
import Todo_Sidebar from './Todo_Sidebar';
import Todo_Quick_Add from './Todo_Quick_Add';
import Todo_Row from './Todo_Row';
import Todo_Detail from './Todo_Detail';
import Todo_List_Actions from './Todo_List_Actions';
import Todo_Sub_Add from './Todo_Sub_Add';
import Todo_Sync from './Todo_Sync';
import { TODO_SECTIONS, addDays, dueDayKey, sectionOf, todayKey } from './todoDates';
import './Todos.scss';
import Page_Help, { Page_Intro } from '../../../Components/Page_Help/Page_Help';

const isView = (value: string): value is TodoView => (TODO_VIEWS as readonly string[]).includes(value);

const Todos = () => {
  const { t } = useTranslation('todos');
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = searchParams.get('list') ?? 'all';
  const openId = searchParams.get('task') ?? '';
  const showDone = searchParams.get('done') === '1';
  const syncOpen = searchParams.get('sync') === '1';
  const [search, setSearch] = useState('');
  const [addingTo, setAddingTo] = useState('');
  const { lists, saving: savingList, fetchLists, createList, renameList, deleteList } = useTodoLists();
  const { todos, loading, error, savingId, fetchTodos, createTodo, updateTodo, deleteTodo } = useTodos();
  const { overview: syncOverview, busy: syncing, fetchOverview: fetchSync, runNow: runSync } = useTodoSync();
  const canSyncNow = Boolean(syncOverview?.groups.length);

  const setParam = (name: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next, { replace: true });
  };

  const selectList = (id: string) => {
    const next = new URLSearchParams(searchParams);
    if (id === 'all') next.delete('list');
    else next.set('list', id);
    next.delete('task');
    setSearchParams(next, { replace: true });
  };

  const currentList = lists.find((list) => list.id === selected) ?? null;
  const today = todayKey();
  const weekEnd = addDays(today, 7);
  const text = search.trim().toLowerCase();

  const inView = (todo: Todo) => {
    if (selected === 'today' || selected === 'week') {
      const day = dueDayKey(todo);
      if (!isOpenTodo(todo) || !day) return false;
      return day <= (selected === 'today' ? today : weekEnd);
    }
    return isView(selected) || todo.listId === selected;
  };

  const visible = todos.filter(
    (todo) => inView(todo) && (!text || todo.title.toLowerCase().includes(text) || (todo.notes ?? '').toLowerCase().includes(text)),
  );
  const visibleIds = new Set(visible.map((todo) => todo.id));
  const topLevel = visible.filter((todo) => !todo.parentId || !visibleIds.has(todo.parentId));
  const childrenOf = (id: string) => todos.filter((todo) => todo.parentId === id);
  const doneCount = topLevel.filter((todo) => !isOpenTodo(todo)).length;
  const openTodo = todos.find((todo) => todo.id === openId) ?? null;
  const listName = (id: string) => lists.find((list) => list.id === id)?.name ?? '';
  const showListName = !currentList;

  const afterChange = async () => {
    await fetchLists();
  };

  const toggle = async (todo: Todo) => {
    const changed = await updateTodo(todo.id, { status: isOpenTodo(todo) ? 'DONE' : 'OPEN' });
    if (changed) await afterChange();
  };

  const quickAdd = async (title: string) => {
    const listId = currentList?.id ?? lists[0]?.id;
    if (!listId) return false;
    const due = selected === 'today' ? { dueAt: `${today}T00:00:00.000Z`, dueAllDay: true } : {};
    const created = await createTodo({ listId, title, ...due });
    if (created) await afterChange();
    return Boolean(created);
  };

  const save = async (id: string, payload: TodoPayload) => {
    const changed = await updateTodo(id, payload);
    if (changed) await afterChange();
    return Boolean(changed);
  };

  const addSubtask = async (parent: Todo, title: string) => {
    const created = await createTodo({ listId: parent.listId, parentId: parent.id, title });
    if (created) await afterChange();
    return Boolean(created);
  };

  const remove = async (id: string) => {
    const removed = await deleteTodo(id);
    if (!removed) return;
    setParam('task', '');
    await afterChange();
  };

  const removeList = async (id: string) => {
    if (!(await deleteList(id))) return;
    selectList('all');
    await fetchTodos();
  };

  const refresh = () => {
    void fetchTodos();
    void fetchLists();
  };

  const syncNow = async () => {
    if (await runSync()) refresh();
  };

  const heading = currentList?.name ?? t(`views.${isView(selected) ? selected : 'all'}`);

  const renderRows = (todo: Todo, depth: number): ReactNode[] => [
    <Todo_Row
      key={todo.id}
      todo={todo}
      depth={depth}
      listName={showListName && depth === 0 ? listName(todo.listId) : ''}
      subtaskCount={todos.filter((child) => child.parentId === todo.id).length}
      selected={todo.id === openId}
      busy={savingId === todo.id}
      onToggle={() => void toggle(todo)}
      onOpen={() => setParam('task', todo.id)}
      onAddSubtask={() => setAddingTo(todo.id)}
    />,
    ...childrenOf(todo.id).flatMap((child) => renderRows(child, depth + 1)),
    ...(addingTo === todo.id
      ? [
          <Todo_Sub_Add
            key={`${todo.id}-new`}
            depth={depth + 1}
            busy={savingId === 'new'}
            onAdd={(title) => addSubtask(todo, title)}
            onClose={() => setAddingTo('')}
          />,
        ]
      : []),
  ];

  const renderSections = () => {
    if (loading) return <p className='Todos_note'>{t('loading')}</p>;
    if (error) return <p className='Todos_note error'>{error}</p>;
    const sections = TODO_SECTIONS.filter((section) => section !== 'done' || showDone)
      .map((section) => ({ section, rows: topLevel.filter((todo) => sectionOf(todo, today) === section) }))
      .filter(({ rows }) => rows.length > 0);
    if (!sections.length) {
      return <p className='Todos_note'>{todos.length ? t('empty.filtered') : t('empty.none')}</p>;
    }
    return sections.map(({ section, rows }) => (
      <section key={section} className={`Todos_section ${section}`}>
        <h3>
          {t(`sections.${section}`)}
          <span>{rows.length}</span>
        </h3>
        <div className='Todos_rows'>{rows.flatMap((todo) => renderRows(todo, 0))}</div>
      </section>
    ));
  };

  return (
    <div className={`Todos${openTodo ? ' with_detail' : ''}`}>
      <header>
        <div className='Right_Side'>
          <span>{t('title')}</span>
          <Page_Help topic='todos' />
        </div>
        <div className='Left_Side'>
          {canSyncNow && (
            <button type='button' className='Todos_sync_button' onClick={() => void syncNow()} disabled={syncing}>
              <Icon.Refresh />
              <span>{syncing ? t('sync.syncing') : t('sync.syncNow')}</span>
            </button>
          )}
          <button type='button' className='Todos_sync_button' onClick={() => setParam('sync', '1')}>
            <Icon.Settings />
            <span>{t('sync.open')}</span>
          </button>
        </div>
      </header>

      {syncOpen && (
        <Todo_Sync
          onClose={() => {
            setParam('sync', '');
            void fetchSync();
          }}
          onSynced={refresh}
        />
      )}

      <Page_Intro page='todos' />

      <div className='Todos_layout'>
        <Todo_Sidebar
          lists={lists}
          todos={todos}
          selected={selected}
          saving={savingList}
          onSelect={selectList}
          onCreate={async (name) => {
            const created = await createList(name);
            if (created) selectList(created.id);
            return Boolean(created);
          }}
        />

        <section className='Todos_main'>
          <div className='Todos_main_head'>
            <h2>{heading}</h2>
            {currentList && (
              <Todo_List_Actions list={currentList} saving={savingList} onRename={renameList} onDelete={removeList} />
            )}
          </div>

          <div className='Todos_toolbar'>
            <label className='Todos_search'>
              <Icon.Search />
              <input type='search' value={search} placeholder={t('search')} aria-label={t('search')} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <button type='button' className={`Todos_done_toggle${showDone ? ' active' : ''}`} onClick={() => setParam('done', showDone ? '' : '1')}>
              {showDone ? t('hideDone') : t('showDone', { count: doneCount })}
            </button>
          </div>

          <Todo_Quick_Add
            placeholder={t('quickAdd', { list: currentList?.name ?? lists[0]?.name ?? '' })}
            disabled={!lists.length}
            busy={savingId === 'new'}
            onAdd={quickAdd}
          />

          <div className='Todos_sections'>{renderSections()}</div>
        </section>

        {openTodo && (
          <Todo_Detail
            key={`${openTodo.id}-${openTodo.updatedAt}`}
            todo={openTodo}
            lists={lists}
            subtasks={todos.filter((todo) => todo.parentId === openTodo.id)}
            parent={todos.find((todo) => todo.id === openTodo.parentId) ?? null}
            saving={savingId === openTodo.id || savingId === 'new'}
            onSave={(payload) => save(openTodo.id, payload)}
            onToggle={(todo) => void toggle(todo)}
            onAddSubtask={(title) => addSubtask(openTodo, title)}
            onOpen={(id) => setParam('task', id)}
            onDelete={() => remove(openTodo.id)}
            onClose={() => setParam('task', '')}
          />
        )}
      </div>
    </div>
  );
};

export default Todos;
