import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Todo_Sub_Add_Props {
  depth: number;
  busy: boolean;
  onAdd: (title: string) => Promise<boolean>;
  onClose: () => void;
}

const Todo_Sub_Add = ({ depth, busy, onAdd, onClose }: Todo_Sub_Add_Props) => {
  const { t } = useTranslation('todos');
  const [title, setTitle] = useState('');

  const add = async () => {
    if (!title.trim() || busy) return;
    if (await onAdd(title.trim())) setTitle('');
  };

  return (
    <div className='Todo_Sub_Add' style={{ paddingLeft: `${38 + depth * 22}px` }}>
      <input
        autoFocus
        value={title}
        maxLength={300}
        placeholder={t('detail.subtaskPlaceholder')}
        aria-label={t('detail.subtaskPlaceholder')}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void add();
          if (e.key === 'Escape') onClose();
        }}
      />
      <button type='button' onClick={onClose}>
        {t('cancel')}
      </button>
      <button type='button' className='primary' onClick={() => void add()} disabled={busy || !title.trim()}>
        {t('add')}
      </button>
    </div>
  );
};

export default Todo_Sub_Add;
