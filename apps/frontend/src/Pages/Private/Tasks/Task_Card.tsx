import { useTranslation } from 'react-i18next';
import type { BoardTask } from '../../../Hooks/Board/boardTypes';
import { formatDay, initials, isOverdue } from './taskFormat';
import * as Icon from '../../../Imports/icons';

interface Task_Card_Props {
  task: BoardTask;
  assigneeName: string | null;
  onOpen: () => void;
  dragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOverCard?: (after: boolean) => void;
}

const Task_Card = ({ task, assigneeName, onOpen, dragging, onDragStart, onDragEnd, onDragOverCard }: Task_Card_Props) => {
  const { t } = useTranslation('tasks');

  return (
    <div
      className={`Task_Card${dragging ? ' dragging' : ''}`}
      role='button'
      tabIndex={0}
      draggable={Boolean(onDragStart)}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        if (!onDragOverCard) return;
        e.preventDefault();
        const box = e.currentTarget.getBoundingClientRect();
        onDragOverCard(e.clientY > box.top + box.height / 2);
      }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onOpen();
      }}
    >
      <div className='Task_Card_Top'>
        <span className='Task_Card_Key'>{task.key}</span>
        {task.priority !== 'NONE' && (
          <span className={`Task_Priority ${task.priority.toLowerCase()}`} title={t(`priority.${task.priority}`)}>
            {t(`priority.${task.priority}`)}
          </span>
        )}
      </div>
      <span className='Task_Card_Title'>{task.title}</span>
      <div className='Task_Card_Chips'>
        {task.modules.map((module) => (
          <span key={module.id} className='module'>
            {module.name}
          </span>
        ))}
        {task.labels.map((label) => (
          <span key={label}>#{label}</span>
        ))}
      </div>
      <div className='Task_Card_Bottom'>
        {task.dueDate && <span className={`Task_Card_Due${isOverdue(task) ? ' late' : ''}`}>{formatDay(task.dueDate)}</span>}
        {task.childCount > 0 && <span className='Task_Card_Meta'>{t('card.children', { count: task.childCount })}</span>}
        {task.commentCount > 0 && (
          <span className='Task_Card_Meta'>
            <Icon.Chat />
            {task.commentCount}
          </span>
        )}
        {assigneeName && (
          <span className='Task_Avatar' title={assigneeName}>
            {initials(assigneeName)}
          </span>
        )}
      </div>
    </div>
  );
};

export default Task_Card;
