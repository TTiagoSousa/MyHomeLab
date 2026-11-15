import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Doc_Editor from '../../../Components/Doc_Editor/Doc_Editor';
import type { TaskComment } from '../../../Hooks/Board/boardTypes';
import { formatDateTime, initials } from './taskFormat';

interface Task_Comments_Props {
  comments: TaskComment[];
  authorName: (key: string) => string;
  hasAgent: boolean;
  saving: boolean;
  onComment: (body: string) => Promise<boolean>;
}

const Task_Comments = ({ comments, authorName, hasAgent, saving, onComment }: Task_Comments_Props) => {
  const { t } = useTranslation('tasks');
  const [text, setText] = useState('');
  const [editorKey, setEditorKey] = useState(0);

  const send = async () => {
    if (!text.trim()) return;
    if (await onComment(text)) {
      setText('');
      setEditorKey((value) => value + 1);
    }
  };

  return (
    <div className='Task_Comments'>
      {comments.length === 0 && <p className='Tasks_Note'>{t('detail.noComments')}</p>}
      {comments.map((comment) => {
        const name = authorName(comment.author);
        return (
          <div key={comment.id} className={`Task_Comment${comment.author === 'user' ? ' mine' : ''}`}>
            <span className='Task_Avatar'>{initials(name)}</span>
            <div className='Task_Comment_Body'>
              <span className='Task_Comment_Head'>
                <strong>{name}</strong> · {formatDateTime(comment.createdAt)}
              </span>
              <Doc_Editor value={comment.body} />
            </div>
          </div>
        );
      })}
      <div className='Task_Comment_New'>
        <Doc_Editor key={editorKey} value='' editable compact placeholder={t('detail.commentPlaceholder')} onChange={setText} />
        <div className='Task_Comment_Actions'>
          <span className='Tasks_Hint'>{hasAgent ? t('detail.commentHint') : t('detail.commentNoAgent')}</span>
          <button type='button' className='Tasks_Solid' onClick={() => void send()} disabled={saving || !text.trim()}>
            {t('detail.send')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Task_Comments;
