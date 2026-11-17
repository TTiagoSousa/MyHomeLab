import { useEffect, useState, type DragEvent, type RefObject, type WheelEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardState, BoardTask } from '../../../Hooks/Board/boardTypes';
import Task_Card from './Task_Card';
import { loadCollapsed, saveCollapsed } from './boardPrefs';
import type { Process_Phase } from './updatePhases';
import Tooltip from '../../../Components/Tooltip/Tooltip';
import * as Icon from '../../../Imports/icons';

const EDGE_PX = 70;
const EDGE_STEP_PX = 22;
const MIN_BOARD_PX = 360;
const BOTTOM_GAP_PX = 24;

interface Tasks_Columns_Props {
  boardRef: RefObject<HTMLDivElement | null>;
  hideEmpty: boolean;
  projectId: string;
  states: BoardState[];
  tasks: BoardTask[];
  assigneeName: (key: string | null) => string | null;
  onOpen: (task: BoardTask) => void;
  onMove: (task: BoardTask, stateId: string, position: number) => void;
  onAdd: (stateId: string) => void;
  phases?: Process_Phase[];
}

interface Drop_Target {
  stateId: string;
  beforeId: string | null;
}

const Tasks_Columns = ({ boardRef, hideEmpty, projectId, states, tasks, assigneeName, onOpen, onMove, onAdd, phases }: Tasks_Columns_Props) => {
  const { t } = useTranslation('tasks');
  const [dragging, setDragging] = useState<BoardTask | null>(null);
  const [target, setTarget] = useState<Drop_Target | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>(() => loadCollapsed(projectId));

  useEffect(() => {
    const fitToScreen = () => {
      const board = boardRef.current;
      if (!board) return;
      const top = board.getBoundingClientRect().top;
      board.style.height = `${Math.max(MIN_BOARD_PX, window.innerHeight - top - BOTTOM_GAP_PX)}px`;
    };
    fitToScreen();
    window.addEventListener('resize', fitToScreen);
    return () => window.removeEventListener('resize', fitToScreen);
  }, [boardRef]);

  const columnTasks = (stateId: string) =>
    tasks.filter((task) => task.stateId === stateId).sort((a, b) => a.position - b.position);

  const isHidden = (stateId: string) => hideEmpty && !dragging && columnTasks(stateId).length === 0;

  const toggleCollapsed = (stateId: string) => {
    const next = collapsed.includes(stateId) ? collapsed.filter((id) => id !== stateId) : [...collapsed, stateId];
    setCollapsed(next);
    saveCollapsed(projectId, next);
  };

  const finishDrag = () => {
    setDragging(null);
    setTarget(null);
  };

  const dropIn = (stateId: string) => {
    if (!dragging) return;
    const beforeId = target?.stateId === stateId ? target.beforeId : null;
    const items = columnTasks(stateId).filter((task) => task.id !== dragging.id);
    const index = beforeId ? items.findIndex((task) => task.id === beforeId) : -1;
    const next = index >= 0 ? items[index] : null;
    const previous = index >= 0 ? items[index - 1] : items[items.length - 1];
    const position = next ? (previous ? (previous.position + next.position) / 2 : next.position - 1) : previous ? previous.position + 1 : 1;
    const current = columnTasks(stateId);
    const own = current.findIndex((task) => task.id === dragging.id);
    const unchanged = own >= 0 && (beforeId === dragging.id || beforeId === (current[own + 1]?.id ?? null));
    if (!unchanged) onMove(dragging, stateId, position);
    finishDrag();
  };

  const scrollNearEdges = (event: DragEvent) => {
    const board = boardRef.current;
    if (!board || !dragging) return;
    const box = board.getBoundingClientRect();
    if (event.clientX < box.left + EDGE_PX) board.scrollLeft -= EDGE_STEP_PX;
    else if (event.clientX > box.right - EDGE_PX) board.scrollLeft += EDGE_STEP_PX;
  };

  const scrollSideways = (event: WheelEvent) => {
    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) boardRef.current?.scrollBy({ left: event.deltaY });
  };

  const dropHandlers = (stateId: string) => ({
    onDragOver: (event: DragEvent) => {
      if (!dragging) return;
      event.preventDefault();
      if (!(event.target as HTMLElement).closest('.Task_Card')) setTarget({ stateId, beforeId: null });
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      dropIn(stateId);
    },
  });

  const dropLine = <div className='Tasks_Drop_Line' />;

  const column = (state: BoardState) => {
    if (isHidden(state.id)) return null;
    const items = columnTasks(state.id);
    const over = target?.stateId === state.id;

    if (collapsed.includes(state.id)) {
      return (
        <section key={state.id} data-state={state.id} className={`Tasks_Column collapsed${over ? ' over' : ''}`} {...dropHandlers(state.id)}>
          <button type='button' className='Tasks_Column_Strip' onClick={() => toggleCollapsed(state.id)} title={t('columns.expand', { name: state.name })}>
            <span className='Tasks_State_Dot' style={{ background: state.color }} />
            <span className='Tasks_Column_Count'>{items.length}</span>
            <span className='Tasks_Column_Name'>{state.name}</span>
          </button>
        </section>
      );
    }

    return (
      <section key={state.id} data-state={state.id} className={`Tasks_Column${over ? ' over' : ''}`} {...dropHandlers(state.id)}>
        <header onWheel={scrollSideways}>
          <button type='button' className='Tasks_Column_Toggle' onClick={() => toggleCollapsed(state.id)} title={t('columns.collapse')}>
            <span className='Tasks_State_Dot' style={{ background: state.color }} />
            <span className='Tasks_Column_Name'>{state.name}</span>
          </button>
          <span className='Tasks_Column_Count'>{items.length}</span>
          <button type='button' className='Tasks_Column_Add' onClick={() => onAdd(state.id)} aria-label={t('actions.newIn', { state: state.name })} title={t('actions.newIn', { state: state.name })}>
            <Icon.Plus />
          </button>
        </header>
        <div className='Tasks_Column_Body'>
          {items.map((task, index) => (
            <div key={task.id} className='Tasks_Card_Slot'>
              {over && target?.beforeId === task.id && dropLine}
              <Task_Card
                task={task}
                assigneeName={assigneeName(task.assignee)}
                dragging={dragging?.id === task.id}
                onOpen={() => onOpen(task)}
                onDragStart={() => setDragging(task)}
                onDragEnd={finishDrag}
                onDragOverCard={(after) => setTarget({ stateId: state.id, beforeId: after ? (items[index + 1]?.id ?? null) : task.id })}
              />
            </div>
          ))}
          {over && target?.beforeId === null && dropLine}
          {items.length === 0 && !over && <p className='Tasks_Column_Empty'>{t('columns.empty')}</p>}
        </div>
      </section>
    );
  };

  return (
    <div className='Tasks_Board'>
      {hideEmpty && !dragging && tasks.length === 0 && <p className='Tasks_Column_Empty'>{t('list.noResults')}</p>}

      <div ref={boardRef} className={`Tasks_Columns${phases ? ' Tasks_Process' : ''}`} onDragOver={scrollNearEdges}>
        {!phases && states.map(column)}
        {phases?.map((phase, index) => {
          const visible = phase.states.filter((state) => !isHidden(state.id));
          if (!visible.length) return null;
          const title = (
            <span className='Tasks_Phase_Head'>
              <span className='Tasks_Phase_Number'>{index + 1}</span>
              <strong>{phase.name ?? t('process.other.title')}</strong>
            </span>
          );
          return (
            <div key={phase.key} className={`Tasks_Phase${phase.hintKey ? ` ${phase.hintKey}` : ''}`}>
              {phase.hintKey ? <Tooltip text={t(`process.${phase.hintKey}.hint`)}>{title}</Tooltip> : title}
              <div className='Tasks_Phase_Columns'>{phase.states.map(column)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Tasks_Columns;
