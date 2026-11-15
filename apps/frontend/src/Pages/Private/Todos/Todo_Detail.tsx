import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { TODO_PRIORITIES, TODO_STATUSES, isOpenTodo, type Todo, type TodoList, type TodoPayload, type TodoPriority } from '../../../Hooks/Todos/todoTypes';
import { dateLocale } from '../../../i18n';
import * as Icon from '../../../Imports/icons';
import { dueDayKey, dueTime, dueToPayload } from './todoDates';
import { linkLabel } from './todoLinks';

interface Todo_Detail_Props {
  todo: Todo;
  lists: TodoList[];
  subtasks: Todo[];
  parent: Todo | null;
  saving: boolean;
  onSave: (payload: TodoPayload) => Promise<boolean>;
  onToggle: (todo: Todo) => void;
  onAddSubtask: (title: string) => Promise<boolean>;
  onOpen: (id: string) => void;
  onDelete: () => Promise<void>;
  onClose: () => void;
}

const draftOf = (todo: Todo) => ({
  title: todo.title,
  notes: todo.notes ?? '',
  date: dueDayKey(todo) ?? '',
  time: dueTime(todo),
  priority: (todo.priority ?? '') as TodoPriority | '',
  listId: todo.listId,
  status: todo.status,
  links: todo.links,
});

const Todo_Detail = ({ todo, lists, subtasks, parent, saving, onSave, onToggle, onAddSubtask, onOpen, onDelete, onClose }: Todo_Detail_Props) => {
  const { t } = useTranslation('todos');
  const navigate = useNavigate();
  const [draft, setDraft] = useState(draftOf(todo));
  const [subtask, setSubtask] = useState('');
  const [newLink, setNewLink] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const initial = draftOf(todo);
  const changed = JSON.stringify(draft) !== JSON.stringify(initial);

  const set = <K extends keyof typeof draft>(name: K, value: (typeof draft)[K]) => setDraft({ ...draft, [name]: value });

  const save = async () => {
    if (!draft.title.trim()) return;
    const dueChanged = draft.date !== initial.date || draft.time !== initial.time;
    await onSave({
      title: draft.title.trim(),
      notes: draft.notes.trim() || null,
      ...(dueChanged ? dueToPayload(draft.date, draft.date ? draft.time : '') : {}),
      priority: draft.priority || null,
      listId: draft.listId,
      status: draft.status,
      links: draft.links,
    });
  };

  const addSubtask = async () => {
    if (!subtask.trim()) return;
    if (await onAddSubtask(subtask.trim())) setSubtask('');
  };

  const openLink = (link: string) => {
    if (link.startsWith('/')) navigate(link);
    else window.open(link, '_blank', 'noopener,noreferrer');
  };

  const addLink = () => {
    const link = newLink.trim();
    if (!link) return;
    if (!draft.links.includes(link)) set('links', [...draft.links, link]);
    setNewLink('');
  };

  const listOptions = lists.map((list) => ({ value: list.id, label: list.name }));
  const priorityOptions = [{ value: '', label: t('priority.none') }, ...TODO_PRIORITIES.map((value) => ({ value, label: t(`priority.${value}`) }))];
  const statusOptions = TODO_STATUSES.map((value) => ({ value, label: t(`status.${value}`) }));

  return (
    <aside className='Todo_Detail'>
      <div className='Todo_Detail_Head'>
        {parent ? (
          <button type='button' className='Todo_Detail_Parent' onClick={() => onOpen(parent.id)}>
            <Icon.Chevron />
            <span>{parent.title}</span>
          </button>
        ) : (
          <span className='Todo_Detail_Kicker'>{t('detail.title')}</span>
        )}
        <button type='button' className='Todo_Detail_Close' onClick={onClose} aria-label={t('detail.close')} title={t('detail.close')}>
          <Icon.Close />
        </button>
      </div>

      <div className='Todo_Detail_Body'>
        <textarea
          className='Todo_Detail_Title'
          rows={2}
          value={draft.title}
          maxLength={300}
          aria-label={t('detail.titleLabel')}
          onChange={(e) => set('title', e.target.value)}
        />

        <div className='Todo_Detail_Grid'>
          <label className='Todo_Detail_Field'>
            <span>{t('detail.date')}</span>
            <Global_Input type='date' value={draft.date} onChange={(e) => set('date', e.target.value)} />
          </label>
          <label className='Todo_Detail_Field'>
            <span>{t('detail.time')}</span>
            <Global_Input type='time' value={draft.time} disabled={!draft.date} onChange={(e) => set('time', e.target.value)} />
          </label>
          <div className='Todo_Detail_Field'>
            <span>{t('detail.priority')}</span>
            <Global_Dropdown value={draft.priority} options={priorityOptions} onChange={(value) => set('priority', value as typeof draft.priority)} />
          </div>
          <div className='Todo_Detail_Field'>
            <span>{t('detail.status')}</span>
            <Global_Dropdown value={draft.status} options={statusOptions} onChange={(value) => set('status', value as typeof draft.status)} />
          </div>
          <div className='Todo_Detail_Field wide'>
            <span>{t('detail.list')}</span>
            <Global_Dropdown value={draft.listId} options={listOptions} onChange={(value) => set('listId', value)} maxVisibleOptions={8} />
          </div>
        </div>

        <div className='Todo_Detail_Subtasks'>
          <span className='Todo_Detail_Label'>{t('detail.subtasks')}</span>
          {subtasks.map((child) => (
            <div key={child.id} className={`Todo_Detail_Subtask${isOpenTodo(child) ? '' : ' done'}`}>
              <button
                type='button'
                className={`Todo_Check small${isOpenTodo(child) ? '' : ' checked'}`}
                onClick={() => onToggle(child)}
                aria-label={isOpenTodo(child) ? t('markDone') : t('markOpen')}
              />
              <button type='button' className='Todo_Detail_Subtask_Title' onClick={() => onOpen(child.id)}>
                {child.title}
              </button>
            </div>
          ))}
          <div className='Todo_Detail_Subtask_New'>
            <input
              value={subtask}
              maxLength={300}
              placeholder={t('detail.subtaskPlaceholder')}
              aria-label={t('detail.subtaskPlaceholder')}
              onChange={(e) => setSubtask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void addSubtask()}
            />
            <button type='button' onClick={() => void addSubtask()} disabled={saving || !subtask.trim()}>
              {t('add')}
            </button>
          </div>
        </div>

        <label className='Todo_Detail_Field'>
          <span>{t('detail.notes')}</span>
          <textarea className='Todo_Detail_Notes' rows={5} value={draft.notes} placeholder={t('detail.notesPlaceholder')} onChange={(e) => set('notes', e.target.value)} />
        </label>

        <div className='Todo_Detail_Field'>
          <span>{t('detail.links')}</span>
          {draft.links.map((link) => (
            <div key={link} className='Todo_Detail_Link_Row'>
              <button type='button' className='Todo_Detail_Link_Open' onClick={() => openLink(link)} title={link}>
                <span>{linkLabel(link)}</span>
                <small>{link}</small>
              </button>
              <button
                type='button'
                className='Todo_Detail_Link_Remove'
                onClick={() => set('links', draft.links.filter((entry) => entry !== link))}
                aria-label={t('detail.removeLink')}
                title={t('detail.removeLink')}
              >
                <Icon.Close />
              </button>
            </div>
          ))}
          <div className='Todo_Detail_Link'>
            <Global_Input
              value={newLink}
              placeholder={t('detail.linkPlaceholder')}
              onChange={(e) => setNewLink(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addLink()}
            />
            <button type='button' onClick={addLink} disabled={!newLink.trim()}>
              {t('add')}
            </button>
          </div>
        </div>

        <p className='Todo_Detail_Info'>
          {todo.agentName ? t('detail.createdBy', { name: todo.agentName }) : t('detail.createdByYou')}
          {' · '}
          {new Date(todo.createdAt).toLocaleString(dateLocale(), { dateStyle: 'short', timeStyle: 'short' })}
          {todo.completedAt && ` · ${t('detail.completedAt', { date: new Date(todo.completedAt).toLocaleString(dateLocale(), { dateStyle: 'short', timeStyle: 'short' }) })}`}
        </p>
      </div>

      <div className='Todo_Detail_Footer'>
        {confirmingDelete ? (
          <>
            <button type='button' onClick={() => setConfirmingDelete(false)} disabled={saving}>
              {t('cancel')}
            </button>
            <button type='button' className='danger' onClick={() => void onDelete()} disabled={saving}>
              {subtasks.length ? t('detail.confirmDeleteWithSubtasks', { count: subtasks.length }) : t('detail.confirmDelete')}
            </button>
          </>
        ) : (
          <>
            <button type='button' className='ghost_danger' onClick={() => setConfirmingDelete(true)} disabled={saving}>
              {t('detail.delete')}
            </button>
            <button type='button' className='primary' onClick={() => void save()} disabled={saving || !changed || !draft.title.trim()}>
              {saving ? t('saving') : t('save')}
            </button>
          </>
        )}
      </div>
    </aside>
  );
};

export default Todo_Detail;
