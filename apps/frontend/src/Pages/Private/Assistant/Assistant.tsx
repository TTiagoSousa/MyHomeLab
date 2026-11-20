import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './Assistant.scss';
import { useAssistant } from '../../../Hooks/Assistant/useAssistant';
import { clearPendingAsk, listenPendingAsks, pendingAsks } from '../../../Hooks/Assistant/pendingAsk';
import { useConversations } from '../../../Hooks/Assistant/useConversations';
import Assistant_Conversations from './Assistant_Conversations';
import { useAgents } from '../../../Hooks/Agent/useAgents';
import Assistant_Settings_Menu from './Assistant_Settings_Menu';
import { assistantSettingsPath } from '../../../Constants/assistantSettings';
import { useAiProviders } from '../../../Hooks/Ai/useAiProviders';
import { useAuth } from '../../../Contexts/Auth_Context';
import * as Icon from '../../../Imports/icons';
import Doc_Editor from '../../../Components/Doc_Editor/Doc_Editor';
import { chatMarkdown } from './chatMarkdown';
import { Assistant_Message_Files, Assistant_Pending_Files } from './Assistant_Files';
import { CHAT_FILE_ACCEPT, MAX_CHAT_FILES, chatFileProblem } from '../../../Hooks/Assistant/chatFiles';
import { useAlert } from '../../../Contexts/Alert_Context';

const SUGGESTED_PROMPTS = [
  'suggestedPrompts.todayEmails',
  'suggestedPrompts.runningMachines',
  'suggestedPrompts.nextcloudOnline',
] as const;

const shortName = (name: string) => name.replace(/^Agente d[eoa]s? /i, '');

const NEW = 'new';

const Assistant = () => {
  const { t } = useTranslation('assistant');
  const [searchParams, setSearchParams] = useSearchParams();
  const { conversations, fetchConversations, renameConversation, deleteConversation } = useConversations();
  const requested = searchParams.get('c');
  const activeId = requested && requested !== NEW ? requested : null;
  const [sideOpen, setSideOpen] = useState(false);

  const openConversation = (id: string) => {
    setSearchParams({ c: id });
    setSideOpen(false);
  };

  const startConversation = () => {
    setSearchParams({ c: NEW });
    setSideOpen(false);
  };

  const { messages, loading, sendMessage } = useAssistant(activeId, (id) => {
    if (id !== activeId) setSearchParams({ c: id }, { replace: true });
    fetchConversations();
  });

  useEffect(() => {
    if (!requested) setSearchParams({ c: pendingAsks().find((ask) => !ask.done)?.conversationId ?? NEW }, { replace: true });
  }, [requested]);

  const [running, setRunning] = useState(pendingAsks().filter((ask) => !ask.done));

  useEffect(
    () =>
      listenPendingAsks((ask) => {
        if (ask.done) {
          if (ask.conversationId === null && activeId !== null) clearPendingAsk(ask);
          fetchConversations();
        }
        setRunning(pendingAsks().filter((item) => !item.done));
      }),
    [activeId],
  );

  const removeConversation = async (id: string) => {
    if ((await deleteConversation(id)) && id === activeId) startConversation();
  };

  const activeConversation = conversations.find((conversation) => conversation.id === activeId);
  const activeTitle = activeConversation?.title;
  const { agents, live } = useAgents();
  const { providers, loading: loadingProviders } = useAiProviders();
  const { username } = useAuth();
  const navigate = useNavigate();

  const noKey = !loadingProviders && providers.length === 0;

  const [input, setInput] = useState('');
  const [attached, setAttached] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const { setAlert } = useAlert();

  const convoRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: File[]) => {
    if (!incoming.length || noKey) return;
    const problem = incoming.map(chatFileProblem).find(Boolean);
    const accepted = incoming.filter((file) => !chatFileProblem(file));
    const room = MAX_CHAT_FILES - attached.length;
    if (problem) setAlert({ open: true, message: problem, type: 'error' });
    else if (accepted.length > room) setAlert({ open: true, message: t('files.tooMany', { count: MAX_CHAT_FILES }), type: 'error' });
    if (room > 0) setAttached([...attached, ...accepted.slice(0, room)]);
  };

  const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');

  const scrolledRef = useRef({ id: '', count: 0 });

  useEffect(() => {
    const convo = convoRef.current;
    if (!convo) return;
    const id = activeId ?? NEW;
    const previous = scrolledRef.current;
    const growing = previous.id === id && previous.count > 0 && messages.length - previous.count <= 2;
    scrolledRef.current = { id, count: messages.length };
    convo.scrollTo({ top: convo.scrollHeight, behavior: growing ? 'smooth' : 'instant' });
  }, [messages, loading]);

  const handleSend = (text: string) => {
    if ((!text.trim() && !attached.length) || loading || noKey) return;
    sendMessage(text, attached);
    setInput('');
    setAttached([]);
    if (inputRef.current) inputRef.current.style.height = '25px';
  };

  const working = agents.filter((agent) => agent.status === 'ACTIVE');
  const busyCount = working.length;

  const thinkingText = (() => {
    if (working.length === 1) {
      return t('thinking.single', {
        agent: shortName(working[0].name).toLowerCase(),
        action: working[0].action ?? t('core.working'),
      });
    }
    if (working.length > 1) return t('thinking.multiple', { count: working.length });
    return t('now.thinking');
  })();

  return (
    <div className='Assistant'>

      <header className='Assistant_Top'>
        <div className='Assistant_Brand'>
          <span className='Assistant_Brand_mark'>
            <svg viewBox='0 0 40 40' aria-hidden='true'>
              <circle cx='20' cy='20' r='18' fill='none' stroke='var(--accent-deep)' strokeWidth='1' />
              <circle cx='20' cy='20' r='13' fill='none' stroke='var(--accent)' strokeWidth='1'
                      strokeDasharray='30 12' opacity='.85' />
              <circle cx='20' cy='20' r='6.5' fill='var(--accent)' opacity='.22' />
              <circle cx='20' cy='20' r='3.4' fill='var(--accent-bright)' />
            </svg>
          </span>

          <span className='Assistant_Brand_text'>
            <span className='Assistant_Brand_name'>JARVIS</span>
            <span className='Assistant_Brand_sub'>home · lab</span>
          </span>
        </div>

        <div className='Assistant_Readout'>
          <div className='Assistant_Stat'>
            <span className='Assistant_Stat_key'>{t('header.status')}</span>
            <span className='Assistant_Stat_val live'>{loading ? t('header.processing') : t('header.listening')}</span>
          </div>
          <div className='Assistant_Stat'>
            <span className='Assistant_Stat_key'>{t('header.working')}</span>
            <span className='Assistant_Stat_val'>{busyCount} / {agents.length}</span>
          </div>
          <div className='Assistant_Stat'>
            <span className='Assistant_Stat_key'>{t('header.realtime')}</span>
            <span className={`Assistant_Stat_val${live ? ' live' : ''}`}>
              {live ? t('header.connected') : t('header.down')}
            </span>
          </div>

          <Assistant_Settings_Menu />

          <button className='Assistant_New' onClick={() => navigate('/MyHomeLab/Assistant/Workflow')} type='button'>
            <Icon.Agents />
            <span>{t('header.workflow')}</span>
          </button>

          <button className='Assistant_New Assistant_Side_toggle' onClick={() => setSideOpen(!sideOpen)} type='button'>
            <Icon.Chat />
            <span>{t('conversations.title')}</span>
          </button>

          <button className='Assistant_New' onClick={startConversation} type='button'>
            <Icon.Plus />
            <span>{t('header.newConversation')}</span>
          </button>
        </div>
      </header>

      <div className='Assistant_Grid'>

        <Assistant_Conversations
          conversations={conversations}
          activeId={activeId}
          open={sideOpen}
          onSelect={openConversation}
          onNew={startConversation}
          onRename={renameConversation}
          onDelete={(id) => void removeConversation(id)}
          answeringIds={running.flatMap((ask) => (ask.conversationId ? [ask.conversationId] : []))}
          answeringNew={running.some((ask) => ask.conversationId === null)}
        />

        <section
          className='Assistant_Frame'
          onDragOver={(e) => {
            if (!hasFiles(e) || noKey) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            setDragging(false);
            addFiles(Array.from(e.dataTransfer.files));
          }}
        >
          {dragging && (
            <div className='Assistant_Drop'>
              <Icon.Paperclip />
              <span className='Assistant_Drop_title'>{t('files.drop')}</span>
              <span className='Assistant_Drop_hint'>{t('files.dropHint')}</span>
            </div>
          )}
          <div className='Assistant_Frame_head'>
            <span className='Assistant_Frame_title'>{activeTitle ?? t('conversations.new')}</span>
            {activeConversation?.taskId ? (
              <button type='button' className='Assistant_Frame_task' onClick={() => navigate(`/MyHomeLab/Projects/${activeConversation.taskId}`)}>
                {t('conversation.openTask', { key: activeConversation.taskKey })}
              </button>
            ) : (
              <span className='Assistant_Frame_meta'>{t('conversation.meta')}</span>
            )}
          </div>

          <div className='Assistant_Convo' ref={convoRef}>
            {noKey && (
              <div className='Assistant_NoKey'>
                <span className='Assistant_NoKey_title'>{t('noKey.title')}</span>
                <span className='Assistant_NoKey_text'>{t('noKey.text')}</span>
                <button type='button' onClick={() => navigate(assistantSettingsPath('ai'))}>
                  {t('noKey.action')}
                </button>
              </div>
            )}

            {messages.length === 0 && !loading && !noKey && (
              <div className='Assistant_Empty'>
                <span className='Assistant_Empty_title'>{t('conversation.emptyTitle')}</span>
                <span className='Assistant_Empty_hint'>
                  {t('conversation.emptyHint')}
                </span>
              </div>
            )}

            {messages.map((message) => (
              <div className={`Assistant_Msg ${message.role === 'user' ? 'me' : 'ai'}`} key={message.id}>
                <span className='Assistant_Msg_who'>
                  {message.role === 'user' ? (username ?? t('conversation.you')) : 'Jarvis'}
                </span>
                {message.files && message.files.length > 0 && <Assistant_Message_Files files={message.files} />}
                {message.role === 'user' ? (
                  message.text && <div className='Assistant_Msg_text'>{message.text}</div>
                ) : (
                  <div className='Assistant_Msg_text rich'>
                    <Doc_Editor value={chatMarkdown(message.text)} />
                  </div>
                )}
                {message.docsUsed && message.docsUsed.length > 0 && (
                  <div className='Assistant_Msg_docs'>
                    <span>{t('conversation.docsUsed')}</span>
                    {message.docsUsed.map((doc) => (
                      <button key={doc.id} type='button' onClick={() => navigate(`/MyHomeLab/Docs/${doc.id}`)}>
                        {doc.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className='Assistant_Thinking'>
                <span className='Assistant_Dots'><i /><i /><i /></span>
                <span>{thinkingText}</span>
              </div>
            )}
          </div>

          <div className='Assistant_Compose'>
            <div className='Assistant_Chips'>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type='button'
                  disabled={loading || noKey}
                  onClick={() => handleSend(t(prompt))}
                >
                  {t(prompt)}
                </button>
              ))}
            </div>

            <Assistant_Pending_Files files={attached} onRemove={(index) => setAttached(attached.filter((_, at) => at !== index))} />

            <div className='Assistant_Bar'>
              <input
                ref={fileInputRef}
                type='file'
                multiple
                hidden
                accept={CHAT_FILE_ACCEPT}
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
              <button
                type='button'
                className='Assistant_Attach'
                onClick={() => fileInputRef.current?.click()}
                disabled={noKey || attached.length >= MAX_CHAT_FILES}
                aria-label={t('files.attach')}
                title={t('files.attach')}
              >
                <Icon.Paperclip />
              </button>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                disabled={noKey}
                placeholder={t('conversation.placeholder')}
                aria-label={t('conversation.inputLabel')}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = '25px';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 108)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                onPaste={(e) => {
                  const pasted = Array.from(e.clipboardData.files);
                  if (!pasted.length) return;
                  e.preventDefault();
                  addFiles(pasted);
                }}
              />

              <button
                type='button'
                className='Assistant_Send'
                onClick={() => handleSend(input)}
                disabled={loading || noKey || (!input.trim() && !attached.length)}
                aria-label={t('conversation.send')}
              >
                <Icon.Send />
              </button>
            </div>
          </div>
        </section>

      </div>

    </div>
  );
};

export default Assistant;
