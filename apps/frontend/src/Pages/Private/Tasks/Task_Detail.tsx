import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useBoardTask } from '../../../Hooks/Board/useBoardTask';
import { useBoardProjects } from '../../../Hooks/Board/useBoardProjects';
import { useAgentNames } from '../../../Hooks/Agent/useAgentNames';
import { useSchedules } from '../../../Hooks/Schedules/useSchedules';
import { useTaskConversation } from '../../../Hooks/Assistant/useTaskConversation';
import Doc_Editor from '../../../Components/Doc_Editor/Doc_Editor';
import Schedule_Card from '../../../Components/Schedule_Card/Schedule_Card';
import Schedule_Modal from '../../../Components/Modals/Schedule_Modal/Schedule_Modal';
import Task_Properties from './Task_Properties';
import Task_Comments from './Task_Comments';
import Task_Links from './Task_Links';
import Task_Relations from './Task_Relations';
import Task_Decision from './Task_Decision';
import { formatDateTime } from './taskFormat';
import * as Icon from '../../../Imports/icons';
import '../../../Components/Schedule_Card/Schedule_Tags.scss';
import './Tasks.scss';

const TABS = ['comments', 'links', 'relations', 'triggers', 'activity'] as const;
type DetailTab = (typeof TABS)[number];

const Task_Detail = () => {
  const { t } = useTranslation('tasks');
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { opening, openTaskConversation } = useTaskConversation();
  const {
    task,
    loading,
    saving,
    error,
    fetchTask,
    saveTask,
    deleteTask,
    addComment,
    addLink,
    removeLink,
    linkDoc,
    unlinkDoc,
    addRelation,
    removeRelation,
    addAttachment,
    removeAttachment,
  } = useBoardTask(taskId);
  const { projects } = useBoardProjects();
  const { agents } = useAgentNames();
  const { saveSchedule, runSchedule } = useSchedules({ linkType: 'TASK', targetId: taskId ?? '' });
  const [tab, setTab] = useState<DetailTab>('comments');
  const [title, setTitle] = useState('');
  const [editingText, setEditingText] = useState(false);
  const [text, setText] = useState('');
  const [creatingTrigger, setCreatingTrigger] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (task) setTitle(task.title);
  }, [task?.id, task?.title]);

  const project = projects.find((item) => item.id === task?.projectId);
  const nameOf = (key: string) => {
    if (key === 'user') return t('assignee.user');
    if (key === 'MyHomeLab') return 'MyHomeLab';
    return agents.find((agent) => agent.key === key)?.name ?? key;
  };
  const openChat = async () => {
    if (!task) return;
    const conversationId = await openTaskConversation(task.id);
    if (conversationId) navigate(`/MyHomeLab/Assistant?c=${conversationId}`);
  };

  const back = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(`/MyHomeLab/Projects${task ? `?project=${task.projectId}` : ''}`);
  };

  const saveTitle = () => {
    if (task && title.trim() && title.trim() !== task.title) void saveTask({ title: title.trim() });
  };

  const saveText = async () => {
    if (await saveTask({ description: text })) setEditingText(false);
  };

  const remove = async () => {
    if (await deleteTask()) navigate(`/MyHomeLab/Projects?project=${task?.projectId ?? ''}`, { replace: true });
  };

  if (!task) {
    return (
      <div className='Tasks Task_Page'>
        <button type='button' className='Tasks_Back' onClick={back}>
          <Icon.Chevron />
          <span>{t('title')}</span>
        </button>
        <p className='Tasks_Note'>{loading ? t('loading') : error || t('detail.notFound')}</p>
      </div>
    );
  }

  return (
    <div className='Tasks Task_Page'>
      <div className='Task_Page_Top'>
        <button type='button' className='Tasks_Back' onClick={back}>
          <Icon.Chevron />
          <span>{task.project.name}</span>
        </button>
        <span className='Task_Card_Key'>{task.key}</span>
        {task.parent && (
          <button type='button' className='Tasks_Ghost' onClick={() => navigate(`/MyHomeLab/Projects/${task.parent!.id}`)}>
            {t('detail.parent', { key: task.parent.key })}
          </button>
        )}
        <button type='button' className='Tasks_Ghost Task_Chat_Button' disabled={opening} onClick={() => void openChat()}>
          <Icon.Chat />
          <span>
            {task.conversation
              ? t('detail.openChat', { date: formatDateTime(task.conversation.lastMessageAt) })
              : t('detail.startChat')}
          </span>
        </button>
      </div>

      <div className='Task_Page_Layout'>
        <main className='Task_Main'>
          <input className='Task_Title_Input' value={title} maxLength={250} aria-label={t('detail.titleLabel')} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />

          <Task_Decision task={task} states={project?.states ?? []} saving={saving} onMove={(stateId) => saveTask({ stateId })} onChanged={() => void fetchTask()} />

          <section className='Task_Section'>
            <div className='Task_Section_Head'>
              <span className='Tasks_Label'>{t('detail.description')}</span>
              {!editingText && (
                <button
                  type='button'
                  className='Tasks_Ghost'
                  onClick={() => {
                    setText(task.description);
                    setEditingText(true);
                  }}
                >
                  {t('detail.edit')}
                </button>
              )}
            </div>
            {editingText ? (
              <>
                <Doc_Editor value={task.description} editable placeholder={t('detail.descriptionPlaceholder')} onChange={setText} />
                <div className='Task_Comment_Actions'>
                  <button type='button' className='Tasks_Ghost' onClick={() => setEditingText(false)} disabled={saving}>
                    {t('common:actions.cancel')}
                  </button>
                  <button type='button' className='Tasks_Solid' onClick={() => void saveText()} disabled={saving}>
                    {t('detail.save')}
                  </button>
                </div>
              </>
            ) : task.description ? (
              <Doc_Editor value={task.description} />
            ) : (
              <p className='Tasks_Note'>{t('detail.noDescription')}</p>
            )}
          </section>

          {task.children.length > 0 && (
            <section className='Task_Section'>
              <span className='Tasks_Label'>{t('detail.children', { count: task.children.length })}</span>
              {task.children.map((child) => (
                <button key={child.id} type='button' className='Tasks_List_Row' onClick={() => navigate(`/MyHomeLab/Projects/${child.id}`)}>
                  <span className='Task_Card_Key'>{child.key}</span>
                  <span className='Tasks_List_Title'>{child.title}</span>
                  <span className='Tasks_State_Pill'>
                    <span className='Tasks_State_Dot' style={{ background: child.state.color }} />
                    {child.state.name}
                  </span>
                </button>
              ))}
            </section>
          )}

          <div className='Tasks_Views Task_Tabs' role='tablist'>
            {TABS.map((item) => (
              <button key={item} type='button' role='tab' aria-selected={tab === item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
                {t(`detail.tabs.${item}`, {
                  count: item === 'comments' ? task.comments.length : item === 'links' ? task.links.length + task.docs.length : item === 'relations' ? task.relations.length + task.attachments.length : item === 'triggers' ? task.schedules.length : task.activity.length,
                })}
              </button>
            ))}
          </div>

          {tab === 'comments' && (
            <Task_Comments
              comments={task.comments}
              authorName={nameOf}
              hasAgent={Boolean(task.updateId || (task.assignee && task.assignee !== 'user') || project?.agentKeys.length)}
              saving={saving}
              onComment={addComment}
            />
          )}
          {tab === 'links' && (
            <Task_Links task={task} saving={saving} onAddLink={addLink} onRemoveLink={(id) => void removeLink(id)} onLinkDoc={linkDoc} onUnlinkDoc={(id) => void unlinkDoc(id)} />
          )}
          {tab === 'relations' && (
            <Task_Relations
              task={task}
              saving={saving}
              onRelate={addRelation}
              onUnrelate={(id) => void removeRelation(id)}
              onAttach={addAttachment}
              onRemoveAttachment={(id) => void removeAttachment(id)}
            />
          )}
          {tab === 'triggers' && (
            <div className='Task_Triggers'>
              <p className='Tasks_Hint'>{t('detail.triggersHint')}</p>
              <div className='Task_Triggers_Grid'>
                {task.schedules.map((schedule) => (
                  <Schedule_Card
                    key={schedule.id}
                    schedule={schedule}
                    agents={agents}
                    onRun={async () => {
                      await runSchedule(schedule.id);
                      await fetchTask();
                    }}
                    onOpen={() => navigate(`/MyHomeLab/Schedules/${schedule.id}`)}
                  />
                ))}
              </div>
              <button type='button' className='Tasks_Ghost' onClick={() => setCreatingTrigger(true)}>
                <Icon.Plus />
                <span>{t('actions.newTrigger')}</span>
              </button>
            </div>
          )}
          {tab === 'activity' && (
            <div className='Task_Activity'>
              {task.activity.map((item) => (
                <div key={item.id} className='Task_Activity_Row'>
                  <span className='Task_Activity_Dot' />
                  <span>
                    <strong>{nameOf(item.actor)}</strong> {item.text}
                  </span>
                  <small>{formatDateTime(item.createdAt)}</small>
                </div>
              ))}
            </div>
          )}
        </main>

        <div className='Task_Side'>
          <Task_Properties task={task} project={project} agents={agents} onSave={(payload) => void saveTask(payload)} />
          {!task.updateId && (
            <div className='Task_Danger'>
              {confirming ? (
                <>
                  <button type='button' className='Tasks_Ghost' onClick={() => setConfirming(false)}>
                    {t('common:actions.cancel')}
                  </button>
                  <button type='button' className='Tasks_Ghost danger' onClick={() => void remove()}>
                    {t('detail.confirmDelete')}
                  </button>
                </>
              ) : (
                <button type='button' className='Tasks_Ghost danger' onClick={() => setConfirming(true)}>
                  {t('detail.delete')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {creatingTrigger && (
        <Schedule_Modal
          existing={null}
          agents={agents}
          link={{ linkType: 'TASK', targetId: task.id, targetLabel: `${task.key} ${task.title}`.slice(0, 200) }}
          saving={false}
          onSave={async (payload) => {
            const failure = await saveSchedule({ ...payload, instruction: payload.instruction || task.title });
            if (!failure) await fetchTask();
            return failure;
          }}
          onClose={() => setCreatingTrigger(false)}
        />
      )}
    </div>
  );
};

export default Task_Detail;
