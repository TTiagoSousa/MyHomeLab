import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TODO_VIEWS, isOpenTodo, type Todo, type TodoList } from '../../../Hooks/Todos/todoTypes';
import * as Icon from '../../../Imports/icons';
import { addDays, dueDayKey, todayKey } from './todoDates';

interface Todo_Sidebar_Props {
  lists: TodoList[];
  todos: Todo[];
  selected: string;
  saving: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<boolean>;
}

const Todo_Sidebar = ({ lists, todos, selected, saving, onSelect, onCreate }: Todo_Sidebar_Props) => {
  const { t } = useTranslation('todos');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const today = todayKey();
  const open = todos.filter(isOpenTodo);
  const dueBy = (limit: string) => open.filter((todo) => {
    const day = dueDayKey(todo);
    return Boolean(day && day <= limit);
  }).length;
  const viewCounts: Record<string, number> = { all: open.length, today: dueBy(today), week: dueBy(addDays(today, 7)) };

  const create = async () => {
    if (!name.trim() || saving) return;
    if (await onCreate(name.trim())) {
      setName('');
      setCreating(false);
    }
  };

  return (
    <aside className='Todos_sidebar'>
      <div className='Todos_sidebar_group'>
        {TODO_VIEWS.map((view) => (
          <button key={view} type='button' className={`Todos_sidebar_item${selected === view ? ' active' : ''}`} onClick={() => onSelect(view)}>
            <span>{t(`views.${view}`)}</span>
            <span className='Todos_sidebar_count'>{viewCounts[view]}</span>
          </button>
        ))}
      </div>

      <div className='Todos_sidebar_group'>
        <span className='Todos_sidebar_label'>{t('lists.title')}</span>
        {lists.map((list) => (
          <button key={list.id} type='button' className={`Todos_sidebar_item${selected === list.id ? ' active' : ''}`} onClick={() => onSelect(list.id)}>
            <span>{list.name}</span>
            <span className='Todos_sidebar_count'>{list.openCount}</span>
          </button>
        ))}

        {creating ? (
          <div className='Todos_sidebar_new'>
            <input
              autoFocus
              value={name}
              maxLength={60}
              placeholder={t('lists.placeholder')}
              aria-label={t('lists.placeholder')}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void create();
                if (e.key === 'Escape') setCreating(false);
              }}
            />
            <button type='button' onClick={() => void create()} disabled={saving || !name.trim()}>
              {t('lists.add')}
            </button>
          </div>
        ) : (
          <button type='button' className='Todos_sidebar_add' onClick={() => setCreating(true)}>
            <Icon.Plus />
            <span>{t('lists.new')}</span>
          </button>
        )}
      </div>
    </aside>
  );
};

export default Todo_Sidebar;
