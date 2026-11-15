import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Conversation } from '../../../Hooks/Assistant/useConversations';
import { dateLocale } from '../../../i18n';
import * as Icon from '../../../Imports/icons';

interface Assistant_Conversations_Props {
  conversations: Conversation[];
  activeId: string | null;
  open: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => Promise<boolean>;
  onDelete: (id: string) => void;
  answeringIds: string[];
  answeringNew: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const groupOf = (date: string) => {
  const day = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = today.getTime() - new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  if (diff <= 0) return 'today';
  if (diff <= DAY_MS) return 'yesterday';
  if (diff <= 7 * DAY_MS) return 'week';
  return 'older';
};

const Assistant_Conversations = ({ conversations, activeId, open, onSelect, onNew, onRename, onDelete, answeringIds, answeringNew }: Assistant_Conversations_Props) => {
  const { t } = useTranslation('assistant');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const groups = ['today', 'yesterday', 'week', 'older']
    .map((group) => ({ group, items: conversations.filter((conversation) => groupOf(conversation.lastMessageAt) === group) }))
    .filter((entry) => entry.items.length);

  const saveRename = async (id: string) => {
    if (draft.trim() && (await onRename(id, draft.trim()))) setRenaming(null);
  };

  return (
    <aside className={`Assistant_Side${open ? ' open' : ''}`}>
      <button type='button' className='Assistant_Side_new' onClick={onNew}>
        <Icon.Plus />
        <span>{t('conversations.new')}</span>
      </button>

      <div className='Assistant_Side_list'>
        {answeringNew && (
          <div className={`Assistant_Side_item${activeId === null ? ' active' : ''}`}>
            <button type='button' className='Assistant_Side_open' onClick={onNew}>
              <span className='Assistant_Side_title'>{t('conversations.new')}</span>
              <span className='Assistant_Side_date'>
                <span className='Assistant_Side_answering'>{t('conversations.answering')}</span>
              </span>
            </button>
          </div>
        )}

        {conversations.length === 0 && !answeringNew && <span className='Assistant_Side_empty'>{t('conversations.empty')}</span>}

        {groups.map(({ group, items }) => (
          <div key={group} className='Assistant_Side_group'>
            <span className='Assistant_Side_group_title'>{t(`conversations.groups.${group}`)}</span>
            {items.map((conversation) => (
              <div key={conversation.id} className={`Assistant_Side_item${conversation.id === activeId ? ' active' : ''}`}>
                {renaming === conversation.id ? (
                  <input
                    className='Assistant_Side_rename'
                    value={draft}
                    autoFocus
                    maxLength={120}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => setRenaming(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveRename(conversation.id);
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                  />
                ) : (
                  <button type='button' className='Assistant_Side_open' onClick={() => onSelect(conversation.id)} title={conversation.title}>
                    <span className='Assistant_Side_title'>{conversation.title}</span>
                    <span className='Assistant_Side_date'>
                      {conversation.taskKey && <span className='Assistant_Side_task'>{conversation.taskKey}</span>}
                      {answeringIds.includes(conversation.id) && <span className='Assistant_Side_answering'>{t('conversations.answering')}</span>}
                      {new Date(conversation.lastMessageAt).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                )}

                {renaming !== conversation.id && (
                  <span className='Assistant_Side_actions'>
                    {confirmDelete === conversation.id ? (
                      <>
                        <button type='button' className='danger' onClick={() => onDelete(conversation.id)} title={t('conversations.confirmDelete')}>
                          {t('conversations.confirmDelete')}
                        </button>
                        <button type='button' onClick={() => setConfirmDelete(null)} title={t('conversations.cancel')}>
                          <Icon.Close />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type='button'
                          onClick={() => {
                            setDraft(conversation.title);
                            setRenaming(conversation.id);
                          }}
                          title={t('conversations.rename')}
                        >
                          <Icon.Pencil />
                        </button>
                        <button type='button' onClick={() => setConfirmDelete(conversation.id)} title={t('conversations.delete')}>
                          <Icon.Close />
                        </button>
                      </>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
};

export default Assistant_Conversations;
