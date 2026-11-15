import { Fragment, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentLog } from '../../../../Hooks/Agent/useAgentLogs';
import type { Agent } from '../../../../Hooks/Agent/useAgents';
import { useAuth } from '../../../../Contexts/Auth_Context';
import { formatClock, formatDay, formatDuration, sameDay } from './workflowFormat';

const KIND_MARK: Record<AgentLog['kind'], string> = {
  REQUEST: '»',
  START: '▶',
  ACTION: '›',
  DONE: '✓',
  FAILED: '✕',
};

const BOTTOM_SLACK = 40;

interface Workflow_Console_Props {
  agents: Agent[];
  logs: AgentLog[];
  loading: boolean;
  hasOlder: boolean;
  onOlder: () => void;
}

const Workflow_Console = ({ agents, logs, loading, hasOlder, onOlder }: Workflow_Console_Props) => {
  const { t } = useTranslation('assistant');
  const { username } = useAuth();
  const bodyRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const olderHeightRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (olderHeightRef.current !== null) {
      body.scrollTop = body.scrollHeight - olderHeightRef.current;
      olderHeightRef.current = null;
    } else if (atBottomRef.current) {
      body.scrollTop = body.scrollHeight;
    }
  }, [logs]);

  const trackScroll = () => {
    const body = bodyRef.current;
    if (!body) return;
    atBottomRef.current = body.scrollHeight - body.scrollTop - body.clientHeight < BOTTOM_SLACK;
  };

  const loadOlder = () => {
    olderHeightRef.current = bodyRef.current?.scrollHeight ?? null;
    onOlder();
  };

  const byKey = new Map(agents.map((agent) => [agent.key, agent]));
  const agentName = (key: string) => byKey.get(key)?.name ?? t(`workflow.short.${key}`, { defaultValue: key });
  const agentHue = (key: string) => `hue-${byKey.get(key)?.color ?? 'none'}`;
  const isRoot = (key: string) => byKey.get(key)?.isRoot ?? key === 'main';

  const lineText = (log: AgentLog) => {
    if (log.kind === 'REQUEST') {
      const from = log.requestedBy === 'user' ? (username ?? t('conversation.you')) : agentName(log.requestedBy ?? '');
      return (
        <>
          <span className='Workflow_Line_route'>{t('workflow.route', { from, to: agentName(log.agent) })}</span>
          <span className='Workflow_Line_quote'>«{log.text}»</span>
        </>
      );
    }
    if (log.kind === 'DONE' || log.kind === 'FAILED') {
      const status = t(log.kind === 'DONE' ? 'workflow.done' : 'workflow.failed', { duration: formatDuration(log.durationMs ?? 0) });
      return (
        <>
          <span className='Workflow_Line_route'>{status}</span>
          {log.text && <span className='Workflow_Line_quote'>{log.text}</span>}
        </>
      );
    }
    return (
      <>
        <span>{log.text}</span>
        {log.kind === 'START' && !log.requestedBy && !isRoot(log.agent) && (
          <span className='Workflow_Line_badge'>{t('workflow.automatic')}</span>
        )}
      </>
    );
  };

  return (
    <section className='Workflow_Console'>
      <div className='Workflow_Console_head'>
        <span className='Workflow_Console_title'>{t('workflow.consoleTitle')}</span>
        <span className='Workflow_Console_meta'>{t('workflow.consoleMeta')}</span>
      </div>

      <div className='Workflow_Console_body' ref={bodyRef} onScroll={trackScroll} role='log' aria-live='polite'>
        {hasOlder && (
          <button type='button' className='Workflow_Console_older' onClick={loadOlder} disabled={loading}>
            {loading ? t('workflow.loading') : t('workflow.older')}
          </button>
        )}

        {!logs.length && !loading && <p className='Workflow_Console_empty'>{t('workflow.empty')}</p>}

        {logs.map((log, index) => (
          <Fragment key={log.id}>
            {(index === 0 || !sameDay(logs[index - 1].createdAt, log.createdAt)) && (
              <div className='Workflow_Day'>{formatDay(log.createdAt)}</div>
            )}
            <div className={`Workflow_Line ${log.kind.toLowerCase()} ${agentHue(log.agent)}`}>
              <span className='Workflow_Line_time'>{formatClock(log.createdAt)}</span>
              <span className='Workflow_Line_agent'>{agentName(log.agent)}</span>
              <span className='Workflow_Line_mark'>{KIND_MARK[log.kind]}</span>
              <span className='Workflow_Line_text'>{lineText(log)}</span>
            </div>
          </Fragment>
        ))}
      </div>
    </section>
  );
};

export default Workflow_Console;
