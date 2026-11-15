import { useTranslation } from 'react-i18next';
import * as Icon from '../../../Imports/icons';
import { isOpenTodo, type Todo } from '../../../Hooks/Todos/todoTypes';
import { dueDayKey, dueTime, formatDay, isOverdue, todayKey, addDays } from './todoDates';

interface Todo_Row_Props {
  todo: Todo;
  depth: number;
  listName: string;
  subtaskCount: number;
  selected: boolean;
  busy: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onAddSubtask: () => void;
}

const Todo_Row = ({ todo, depth, listName, subtaskCount, selected, busy, onToggle, onOpen, onAddSubtask }: Todo_Row_Props) => {
  const { t } = useTranslation('todos');
  const open = isOpenTodo(todo);
  const day = dueDayKey(todo);
  const today = todayKey();

  const dayLabel = () => {
    if (!day) return '';
    if (day === today) return t('due.today');
    if (day === addDays(today, 1)) return t('due.tomorrow');
    if (day === addDays(today, -1)) return t('due.yesterday');
    return formatDay(day);
  };

  return (
    <div className={`Todo_Row${selected ? ' selected' : ''}${open ? '' : ' done'}`} style={{ paddingLeft: `${10 + depth * 22}px` }}>
      <button
        type='button'
        className={`Todo_Check${open ? '' : ' checked'}${todo.priority ? ` ${todo.priority.toLowerCase()}` : ''}`}
        onClick={onToggle}
        disabled={busy}
        aria-label={open ? t('markDone') : t('markOpen')}
        title={open ? t('markDone') : t('markOpen')}
      />
      <button type='button' className='Todo_Row_Body' onClick={onOpen}>
        <span className='Todo_Row_Title'>{todo.title}</span>
        <span className='Todo_Row_Meta'>
          {todo.status === 'IN_PROGRESS' && <span className='Todo_Tag progress'>{t('status.IN_PROGRESS')}</span>}
          {todo.status === 'CANCELLED' && <span className='Todo_Tag'>{t('status.CANCELLED')}</span>}
          {day && (
            <span className={`Todo_Tag due${isOverdue(todo) ? ' overdue' : ''}`}>
              {dayLabel()}
              {dueTime(todo) && ` · ${dueTime(todo)}`}
            </span>
          )}
          {todo.priority && <span className={`Todo_Tag priority ${todo.priority.toLowerCase()}`}>{t(`priority.${todo.priority}`)}</span>}
          {listName && <span className='Todo_Tag list'>{listName}</span>}
          {subtaskCount > 0 && <span className='Todo_Tag'>{t('subtaskCount', { count: subtaskCount })}</span>}
          {todo.links.length > 0 && <span className='Todo_Tag'>{t('linkCount', { count: todo.links.length })}</span>}
          {todo.agentName && <span className='Todo_Tag agent'>{todo.agentName}</span>}
          {todo.notes && <span className='Todo_Row_Notes'>{todo.notes.split('\n')[0]}</span>}
        </span>
      </button>
      <button type='button' className='Todo_Row_Add' onClick={onAddSubtask} aria-label={t('addSubtask')} title={t('addSubtask')}>
        <Icon.Plus />
        <span>{t('sub')}</span>
      </button>
    </div>
  );
};

export default Todo_Row;
