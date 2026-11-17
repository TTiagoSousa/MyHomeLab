import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBoardProjects } from '../../../Hooks/Board/useBoardProjects';
import { useBoardTasks } from '../../../Hooks/Board/useBoardTasks';
import { useAgentNames } from '../../../Hooks/Agent/useAgentNames';
import type { BoardTask, TaskFilters, TasksView } from '../../../Hooks/Board/boardTypes';
import Project_Modal from '../../../Components/Modals/Project_Modal/Project_Modal';
import Task_Modal from '../../../Components/Modals/Task_Modal/Task_Modal';
import Schedules_View from '../Schedules/Schedules_View';
import Tasks_Filters from './Tasks_Filters';
import Tasks_Columns from './Tasks_Columns';
import Tasks_List from './Tasks_List';
import Tasks_Table from './Tasks_Table';
import Project_Settings from './Project_Settings';
import Tasks_Bulk_Bar from './Tasks_Bulk_Bar';
import Tasks_Columns_Nav from './Tasks_Columns_Nav';
import { loadHideEmpty, saveHideEmpty } from './boardPrefs';
import Tooltip from '../../../Components/Tooltip/Tooltip';
import { statePhases } from './updatePhases';
import * as Icon from '../../../Imports/icons';
import '../../../Components/Linked_Docs/Linked_Docs.scss';
import './Tasks.scss';
import Page_Help, { Page_Intro } from '../../../Components/Page_Help/Page_Help';

const BOARD_VIEWS: TasksView[] = ['columns', 'list', 'table'];
const VIEWS: TasksView[] = [...BOARD_VIEWS, 'triggers'];
const FILTER_KEYS: (keyof TaskFilters)[] = ['stateId', 'priority', 'assignee', 'label', 'moduleId', 'cycleId'];
const SEARCH_DELAY_MS = 300;
const COLUMN_STEP_PX = 292;

const Tasks = () => {
  const { t } = useTranslation('tasks');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectActions = useBoardProjects();
  const { projects, loading, error, saveProject } = projectActions;
  const { agents } = useAgentNames();

  const requestedView = searchParams.get('view') as TasksView | null;
  const view: TasksView = requestedView && VIEWS.includes(requestedView) ? requestedView : 'columns';
  const project = projects.find((item) => item.id === searchParams.get('project')) ?? projects[0];
  const search = searchParams.get('q') ?? '';
  const filters: TaskFilters = {
    search,
    stateId: searchParams.get('stateId') ?? '',
    priority: searchParams.get('priority') ?? '',
    assignee: searchParams.get('assignee') ?? '',
    label: searchParams.get('label') ?? '',
    moduleId: searchParams.get('moduleId') ?? '',
    cycleId: searchParams.get('cycleId') ?? '',
  };
  const [searchText, setSearchText] = useState(search);
  const [urlSearch, setUrlSearch] = useState(search);
  if (search !== urlSearch) {
    setUrlSearch(search);
    if (search !== searchText.trim()) setSearchText(search);
  }
  const { tasks, loading: loadingTasks, error: tasksError, createTask, moveTask, bulkUpdate } = useBoardTasks(project?.id, filters);
  const [selected, setSelected] = useState<string[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const [hideEmpty, setHideEmpty] = useState(loadHideEmpty);

  const changeHideEmpty = (hide: boolean) => {
    setHideEmpty(hide);
    saveHideEmpty(hide);
  };

  const stepColumns = (direction: 1 | -1) => boardRef.current?.scrollBy({ left: direction * COLUMN_STEP_PX, behavior: 'smooth' });

  const [creatingIn, setCreatingIn] = useState<string | null | undefined>(undefined);
  const [editingProject, setEditingProject] = useState<'new' | 'edit' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [creatingTrigger, setCreatingTrigger] = useState(false);

  const setParam = (name: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next, { replace: true });
  };

  const toggleSelected = (ids: string[], on: boolean) =>
    setSelected((current) => (on ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id))));

  const selectProject = (id: string) => {
    setSelected([]);
    const next = new URLSearchParams(searchParams);
    next.set('project', id);
    ['q', ...FILTER_KEYS].forEach((key) => next.delete(key));
    setSearchText('');
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['q', ...FILTER_KEYS].forEach((key) => next.delete(key));
    setSearchText('');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchText.trim() !== search) setParam('q', searchText.trim());
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const assigneeName = (key: string | null) => {
    if (!key) return null;
    if (key === 'user') return t('assignee.user');
    return agents.find((agent) => agent.key === key)?.name ?? key;
  };
  const labels = [...new Set([...tasks.flatMap((task) => task.labels), ...(filters.label ? [filters.label] : [])])].sort();
  const visibleSelected = selected.filter((id) => tasks.some((task) => task.id === id));
  const openTask = (task: BoardTask) => navigate(`/MyHomeLab/Projects/${task.id}`);

  const renderBoard = () => {
    if (!project) return null;
    if (loadingTasks) return <p className='Tasks_Note'>{t('loading')}</p>;
    if (tasksError) return <p className='Tasks_Note error'>{tasksError}</p>;
    if (view === 'columns') {
      return (
        <Tasks_Columns
          key={project.id}
          boardRef={boardRef}
          hideEmpty={hideEmpty}
          projectId={project.id}
          states={project.states}
          tasks={tasks}
          assigneeName={assigneeName}
          onOpen={openTask}
          onMove={(task, stateId, position) => void moveTask(task, stateId, position)}
          onAdd={(stateId) => setCreatingIn(stateId)}
          phases={statePhases(project.states)}
        />
      );
    }
    if (view === 'list') {
      return (
        <Tasks_List
          key={project.id}
          states={project.states}
          tasks={tasks}
          assigneeName={assigneeName}
          selected={selected}
          onSelect={toggleSelected}
          onOpen={openTask}
          onAdd={(stateId) => setCreatingIn(stateId)}
        />
      );
    }
    return <Tasks_Table states={project.states} tasks={tasks} assigneeName={assigneeName} selected={selected} onSelect={toggleSelected} onOpen={openTask} />;
  };

  return (
    <div className='Tasks'>
      <header>
        <div className='Right_Side'>
          <span>{t('title')}</span>
          <Page_Help topic='tasks' />
        </div>
        <div className='Left_Side'>
          {view !== 'triggers' && (
            <div className='Tasks_Views' role='tablist'>
              {BOARD_VIEWS.map((item) => (
                <button key={item} type='button' role='tab' aria-selected={view === item} className={view === item ? 'active' : ''} onClick={() => setParam('view', item === 'columns' ? '' : item)}>
                  {t(`views.${item}`)}
                </button>
              ))}
            </div>
          )}
          <button
            type='button'
            className='Tasks_New'
            onClick={() => (view === 'triggers' ? setCreatingTrigger(true) : setCreatingIn(null))}
            disabled={view !== 'triggers' && !project}
          >
            <Icon.Plus />
            <span>{view === 'triggers' ? t('actions.newTrigger') : t('actions.new')}</span>
          </button>
        </div>
      </header>

      <Page_Intro page='projects' />

      <nav className='Tasks_Sections' aria-label={t('title')}>
        <button type='button' aria-current={view !== 'triggers' ? 'page' : undefined} className={view !== 'triggers' ? 'active' : ''} onClick={() => setParam('view', '')}>
          <Icon.Board />
          {t('sections.board')}
        </button>
        <button type='button' aria-current={view === 'triggers' ? 'page' : undefined} className={view === 'triggers' ? 'active' : ''} onClick={() => setParam('view', 'triggers')}>
          <Icon.Clock />
          {t('sections.triggers')}
        </button>
      </nav>

      {view === 'triggers' ? (
        <Schedules_View creating={creatingTrigger} onCreate={() => setCreatingTrigger(true)} onCloseCreate={() => setCreatingTrigger(false)} />
      ) : (
        <>
          {loading && <p className='Tasks_Note'>{t('loading')}</p>}
          {!loading && error && <p className='Tasks_Note error'>{error}</p>}
          {!loading && !error && (
            <div className='Tasks_Projects'>
              {projects.map((item) => (
                <button key={item.id} type='button' className={item.id === project?.id ? 'active' : ''} onClick={() => selectProject(item.id)}>
                  <span className='Tasks_Project_Key'>{item.identifier}</span>
                  <span>{item.name}</span>
                  <span className='Tasks_Column_Count'>{item.openCount}</span>
                </button>
              ))}
              <button type='button' className='Tasks_Project_Add' onClick={() => setEditingProject('new')}>
                <Icon.Plus />
                <span>{t('actions.newProject')}</span>
              </button>
              {project?.description && (
                <Tooltip text={project.description}>
                  <span className='Tasks_Project_Info'>i</span>
                </Tooltip>
              )}
              {project && (
                <button type='button' className='Tasks_Project_Settings' onClick={() => setShowSettings(true)} aria-label={t('actions.projectSettings')} title={t('actions.projectSettings')}>
                  <Icon.Settings />
                </button>
              )}
            </div>
          )}

          {project && (
            <Tasks_Filters
              search={searchText}
              filters={filters}
              project={project}
              agents={agents}
              labels={labels}
              tools={view === 'columns' && <Tasks_Columns_Nav hideEmpty={hideEmpty} onStep={stepColumns} onHideEmpty={changeHideEmpty} />}
              onSearch={setSearchText}
              onFilter={(name, value) => setParam(name, value)}
              onClear={clearFilters}
            />
          )}

          {view !== 'columns' && project && visibleSelected.length > 0 && (
            <Tasks_Bulk_Bar
              count={visibleSelected.length}
              project={project}
              agents={agents}
              onApply={async (payload) => {
                if (await bulkUpdate(visibleSelected, payload)) setSelected([]);
              }}
              onClear={() => setSelected([])}
            />
          )}

          {renderBoard()}
        </>
      )}

      {creatingIn !== undefined && project && (
        <Task_Modal
          project={project}
          stateId={creatingIn}
          agents={agents}
          onSave={async (payload) => {
            const result = await createTask(payload);
            return typeof result === 'string' ? result : null;
          }}
          onClose={() => setCreatingIn(undefined)}
        />
      )}

      {editingProject && (
        <Project_Modal
          existing={editingProject === 'edit' ? (project ?? null) : null}
          agents={agents}
          saving={projectActions.saving}
          onSave={async (payload) => {
            const { failure, projectId } = await saveProject(payload, editingProject === 'edit' ? project?.id : undefined);
            if (!failure && projectId) selectProject(projectId);
            return failure;
          }}
          onClose={() => setEditingProject(null)}
        />
      )}

      {showSettings && project && (
        <Project_Settings
          project={project}
          actions={projectActions}
          onEdit={() => {
            setShowSettings(false);
            setEditingProject('edit');
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

export default Tasks;
