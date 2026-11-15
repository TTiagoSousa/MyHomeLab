import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Icon from '../../../Imports/icons';

interface Todo_Quick_Add_Props {
  placeholder: string;
  disabled: boolean;
  busy: boolean;
  onAdd: (title: string) => Promise<boolean>;
}

const Todo_Quick_Add = ({ placeholder, disabled, busy, onAdd }: Todo_Quick_Add_Props) => {
  const { t } = useTranslation('todos');
  const [title, setTitle] = useState('');

  const add = async () => {
    if (!title.trim() || busy) return;
    if (await onAdd(title.trim())) setTitle('');
  };

  return (
    <div className='Todos_quick_add'>
      <Icon.Plus />
      <input
        value={title}
        maxLength={300}
        placeholder={placeholder}
        aria-label={placeholder}
        disabled={disabled}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void add()}
      />
      <button type='button' onClick={() => void add()} disabled={disabled || busy || !title.trim()}>
        {busy ? t('adding') : t('add')}
      </button>
    </div>
  );
};

export default Todo_Quick_Add;
