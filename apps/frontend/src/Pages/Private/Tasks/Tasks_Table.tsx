import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardState, BoardTask } from '../../../Hooks/Board/boardTypes';
import { PRIORITY_RANK, formatDateTime, formatDay, isOverdue } from './taskFormat';
import * as Icon from '../../../Imports/icons';

const PAGE_SIZE = 25;

type SortKey = 'key' | 'title' | 'state' | 'priority' | 'assignee' | 'dueDate' | 'updatedAt';

interface Tasks_Table_Props {
  states: BoardState[];
  tasks: BoardTask[];
  assigneeName: (key: string | null) => string | null;
  selected: string[];
  onSelect: (ids: string[], on: boolean) => void;
  onOpen: (task: BoardTask) => void;
}

const COLUMNS: SortKey[] = ['key', 'title', 'state', 'priority', 'assignee', 'dueDate', 'updatedAt'];

const Tasks_Table = ({ states, tasks, assigneeName, selected, onSelect, onOpen }: Tasks_Table_Props) => {
  const { t } = useTranslation('tasks');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'updatedAt', desc: true });
  const [page, setPage] = useState(0);

  const statePosition = (task: BoardTask) => states.findIndex((state) => state.id === task.stateId);
  const value = (task: BoardTask): string | number => {
    switch (sort.key) {
      case 'key':
        return task.number;
      case 'title':
        return task.title.toLowerCase();
      case 'state':
        return statePosition(task);
      case 'priority':
        return PRIORITY_RANK[task.priority];
      case 'assignee':
        return (assigneeName(task.assignee) ?? '~').toLowerCase();
      case 'dueDate':
        return task.dueDate ? new Date(task.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      default:
        return new Date(task.updatedAt).getTime();
    }
  };
  const sorted = [...tasks].sort((a, b) => {
    const order = value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : 0;
    return sort.desc ? -order : order;
  });
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const sortBy = (key: SortKey) => {
    setSort((previous) => ({ key, desc: previous.key === key ? !previous.desc : false }));
    setPage(0);
  };

  return (
    <div className='Tasks_Table_Wrap'>
      <div className='Tasks_Table_Scroll'>
        <table className='Tasks_Table'>
          <thead>
            <tr>
              <th className='Tasks_Select_Cell'>
                <input
                  type='checkbox'
                  className='Tasks_Select'
                  aria-label={t('bulk.selectPage')}
                  checked={visible.length > 0 && visible.every((task) => selected.includes(task.id))}
                  onChange={(e) => onSelect(visible.map((task) => task.id), e.target.checked)}
                />
              </th>
              {COLUMNS.map((key) => (
                <th key={key}>
                  <button type='button' onClick={() => sortBy(key)} className={sort.key === key ? 'active' : ''}>
                    {t(`table.${key}`)}
                    {sort.key === key && <span className={`Tasks_Sort${sort.desc ? ' desc' : ''}`}>▲</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((task) => (
              <tr key={task.id} className={selected.includes(task.id) ? 'selected' : ''} onClick={() => onOpen(task)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen(task)}>
                <td className='Tasks_Select_Cell' onClick={(e) => e.stopPropagation()}>
                  <input type='checkbox' className='Tasks_Select' aria-label={t('bulk.select', { key: task.key })} checked={selected.includes(task.id)} onChange={(e) => onSelect([task.id], e.target.checked)} />
                </td>
                <td className='Task_Card_Key'>{task.key}</td>
                <td className='Tasks_Table_Title'>{task.title}</td>
                <td>
                  <span className='Tasks_State_Pill'>
                    <span className='Tasks_State_Dot' style={{ background: task.state.color }} />
                    {task.state.name}
                  </span>
                </td>
                <td>{task.priority !== 'NONE' && <span className={`Task_Priority ${task.priority.toLowerCase()}`}>{t(`priority.${task.priority}`)}</span>}</td>
                <td>{assigneeName(task.assignee) ?? '—'}</td>
                <td className={isOverdue(task) ? 'late' : ''}>{formatDay(task.dueDate) || '—'}</td>
                <td>{formatDateTime(task.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tasks.length === 0 && <p className='Tasks_Column_Empty'>{t('list.noResults')}</p>}
      {pages > 1 && (
        <div className='Linked_Docs_Pager Tasks_Pager'>
          <button type='button' className='prev' onClick={() => setPage(current - 1)} disabled={current === 0} aria-label={t('list.previous')}>
            <Icon.Chevron />
          </button>
          <span>{t('list.page', { page: current + 1, pages })}</span>
          <button type='button' onClick={() => setPage(current + 1)} disabled={current === pages - 1} aria-label={t('list.next')}>
            <Icon.Chevron />
          </button>
        </div>
      )}
    </div>
  );
};

export default Tasks_Table;
