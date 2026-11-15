import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TodoList } from '../../../Hooks/Todos/todoTypes';

interface Todo_List_Actions_Props {
  list: TodoList;
  saving: boolean;
  onRename: (id: string, name: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
}

const Todo_List_Actions = ({ list, saving, onRename, onDelete }: Todo_List_Actions_Props) => {
  const { t } = useTranslation('todos');
  const [mode, setMode] = useState<'idle' | 'rename' | 'delete'>('idle');
  const [name, setName] = useState(list.name);

  const rename = async () => {
    if (!name.trim() || name.trim() === list.name) return setMode('idle');
    if (await onRename(list.id, name.trim())) setMode('idle');
  };

  if (mode === 'rename') {
    return (
      <div className='Todos_list_actions'>
        <input
          autoFocus
          value={name}
          maxLength={60}
          aria-label={t('lists.rename')}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void rename();
            if (e.key === 'Escape') setMode('idle');
          }}
        />
        <button type='button' onClick={() => setMode('idle')} disabled={saving}>
          {t('cancel')}
        </button>
        <button type='button' className='primary' onClick={() => void rename()} disabled={saving || !name.trim()}>
          {t('save')}
        </button>
      </div>
    );
  }

  if (mode === 'delete') {
    return (
      <div className='Todos_list_actions'>
        <span className='Todos_list_warning'>{t('lists.deleteWarning', { count: list.openCount })}</span>
        <button type='button' onClick={() => setMode('idle')} disabled={saving}>
          {t('cancel')}
        </button>
        <button type='button' className='danger' onClick={() => void onDelete(list.id)} disabled={saving}>
          {t('lists.confirmDelete')}
        </button>
      </div>
    );
  }

  return (
    <div className='Todos_list_actions'>
      <button
        type='button'
        onClick={() => {
          setName(list.name);
          setMode('rename');
        }}
      >
        {t('lists.rename')}
      </button>
      <button type='button' onClick={() => setMode('delete')}>
        {t('lists.delete')}
      </button>
    </div>
  );
};

export default Todo_List_Actions;
