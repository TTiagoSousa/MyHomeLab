import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardState, BoardTask } from '../../../Hooks/Board/boardTypes';
import { formatDay, initials, isOverdue } from './taskFormat';
import * as Icon from '../../../Imports/icons';

interface Tasks_List_Props {
  states: BoardState[];
  tasks: BoardTask[];
  assigneeName: (key: string | null) => string | null;
  selected: string[];
  onSelect: (ids: string[], on: boolean) => void;
  onOpen: (task: BoardTask) => void;
  onAdd: (stateId: string) => void;
}

const Tasks_List = ({ states, tasks, assigneeName, selected, onSelect, onOpen, onAdd }: Tasks_List_Props) => {
  const { t } = useTranslation('tasks');
  const [closed, setClosed] = useState<string[]>([]);

  const toggle = (id: string) =>
    setClosed((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <div className='Tasks_List'>
      {states.map((state) => {
        const items = tasks.filter((task) => task.stateId === state.id).sort((a, b) => a.position - b.position);
        const open = !closed.includes(state.id);
        return (
          <section key={state.id} className='Tasks_List_Group'>
            <header>
              <button type='button' className='Tasks_List_Toggle' onClick={() => toggle(state.id)} aria-expanded={open}>
                <span className={`Tasks_Chevron${open ? ' open' : ''}`}>
                  <Icon.Chevron />
                </span>
                <span className='Tasks_State_Dot' style={{ background: state.color }} />
                <span className='Tasks_Column_Name'>{state.name}</span>
                <span className='Tasks_Column_Count'>{items.length}</span>
              </button>
              <button type='button' className='Tasks_List_Add' onClick={() => onAdd(state.id)} aria-label={t('actions.newIn', { state: state.name })}>
                <Icon.Plus />
              </button>
            </header>
            {open &&
              items.map((task) => {
                const name = assigneeName(task.assignee);
                return (
                  <div key={task.id} className={`Tasks_List_Row${selected.includes(task.id) ? ' selected' : ''}`} role='button' tabIndex={0} onClick={() => onOpen(task)} onKeyDown={(e) => e.key === 'Enter' && onOpen(task)}>
                    <input
                      type='checkbox'
                      className='Tasks_Select'
                      checked={selected.includes(task.id)}
                      aria-label={t('bulk.select', { key: task.key })}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onSelect([task.id], e.target.checked)}
                    />
                    <span className='Task_Card_Key'>{task.key}</span>
                    <span className='Tasks_List_Title'>{task.title}</span>
                    <span className='Tasks_List_Chips'>
                      {task.priority !== 'NONE' && (
                        <span className={`Task_Priority ${task.priority.toLowerCase()}`}>{t(`priority.${task.priority}`)}</span>
                      )}
                      {task.modules.slice(0, 2).map((module) => (
                        <span key={module.id} className='Tasks_Chip'>
                          {module.name}
                        </span>
                      ))}
                      {task.dueDate && <span className={`Task_Card_Due${isOverdue(task) ? ' late' : ''}`}>{formatDay(task.dueDate)}</span>}
                      {name && (
                        <span className='Task_Avatar' title={name}>
                          {initials(name)}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            {open && items.length === 0 && <p className='Tasks_Column_Empty'>{t('columns.empty')}</p>}
          </section>
        );
      })}
    </div>
  );
};

export default Tasks_List;
