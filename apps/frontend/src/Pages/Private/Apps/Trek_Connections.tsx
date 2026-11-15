import './Apps.scss';
import '../Email/Gmail_Connections.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useTrekTools, type TrekTool } from '../../../Hooks/ConnectedAccount/useTrekMcp';
import { Apps_Detail_Header, Apps_Section } from './appsShared';
import * as Icon from '../../../Imports/icons';
import { TREK_REST_CALLS, TREK_SCOPE_GROUPS } from './trekApiCalls';

type Tool_Filter = 'all' | 'read' | 'write' | 'delete';

const TOOL_FILTERS: Tool_Filter[] = ['all', 'read', 'write', 'delete'];

const kindOf = (tool: TrekTool): Exclude<Tool_Filter, 'all'> => (tool.destructive ? 'delete' : tool.readOnly ? 'read' : 'write');

const toolsFor = (tools: TrekTool[], filter: Tool_Filter) => (filter === 'all' ? tools : tools.filter((tool) => kindOf(tool) === filter));

const KIND_CLASS: Record<Exclude<Tool_Filter, 'all'>, string> = { read: 'get', write: 'post', delete: 'delete' };

const Scopes_Table = () => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            <th>{t('apps.trek.connections.table.group')}</th>
            <th>{t('apps.trek.connections.table.scopes')}</th>
            <th>{t('apps.trek.connections.table.allows')}</th>
          </tr>
        </thead>
        <tbody>
          {TREK_SCOPE_GROUPS.map((item) => (
            <tr key={item.group}>
              <td>{t(`apps.trek.connections.groups.${item.group}`)}</td>
              <td>
                <span className='Gmail_Table_Tags'>
                  {item.scopes.map((scope) => (
                    <code key={scope}>{scope}</code>
                  ))}
                </span>
              </td>
              <td className='Gmail_Table_Description'>{t(`apps.trek.connections.scopes.${item.group}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Tools_Table = ({ tools }: { tools: TrekTool[] }) => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            <th>{t('apps.trek.connections.table.kind')}</th>
            <th>{t('apps.trek.connections.table.tool')}</th>
            <th>{t('apps.trek.connections.table.description')}</th>
            <th>{t('apps.trek.connections.table.usedBy')}</th>
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => {
            const kind = kindOf(tool);
            return (
              <tr key={tool.name}>
                <td>
                  <span className={`Gmail_Table_Method ${KIND_CLASS[kind]}`}>{t(`apps.trek.connections.kind.${kind}`)}</span>
                </td>
                <td>
                  <code>{tool.name}</code>
                </td>
                <td className='Gmail_Table_Description'>{tool.title ? `${tool.title} — ` : ''}{tool.description.split('\n')[0]}</td>
                <td>
                  <span className='Gmail_Table_Tags'>
                    <span>{kind === 'read' ? 'trek_read' : 'trek_write'}</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const Rest_Table = () => {
  const { t } = useTranslation('addons');

  return (
    <div className='Gmail_Table_Scroll'>
      <table className='Gmail_Table'>
        <thead>
          <tr>
            <th>{t('apps.trek.connections.table.method')}</th>
            <th>{t('apps.trek.connections.table.path')}</th>
            <th>{t('apps.trek.connections.table.description')}</th>
            <th>{t('apps.trek.connections.table.usedBy')}</th>
            <th>{t('apps.trek.connections.table.auth')}</th>
          </tr>
        </thead>
        <tbody>
          {TREK_REST_CALLS.map((call) => (
            <tr key={call.id}>
              <td>
                <span className={`Gmail_Table_Method ${call.method.toLowerCase()}`}>{call.method}</span>
              </td>
              <td>
                <code>{call.path}</code>
              </td>
              <td className='Gmail_Table_Description'>{t(`apps.trek.connections.calls.${call.id}`)}</td>
              <td>
                <span className='Gmail_Table_Tags'>
                  {call.usedBy.map((consumer) => (
                    <span key={consumer}>{t(`apps.trek.connections.usedBy.${consumer}`)}</span>
                  ))}
                </span>
              </td>
              <td>{t(`apps.trek.connections.auth.${call.auth}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Trek_Connections = () => {
  const { t } = useTranslation('addons');
  const { accountId } = useParams();
  const { connectedAccounts, loading } = useConnectedAccounts('TREK');
  const { connected, tools, loading: loadingTools, error } = useTrekTools(accountId);
  const [filter, setFilter] = useState<Tool_Filter>('all');

  const account = connectedAccounts.find((item) => item.id === accountId);
  const name = account?.displayName ?? account?.appHost ?? 'TREK';

  return (
    <div className='Apps'>
      <Apps_Detail_Header backTo={`/MyHomeLab/Apps/Trek/${accountId}`} backLabel={name} title={t('apps.trek.connections.title')} />

      {!account ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.trek.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <Apps_Section icon={<Icon.Agents />} title={t('apps.trek.connections.toolsTitle')} description={t('apps.trek.connections.toolsSummary', { base: account.appHost ?? '' })}>
            {loadingTools && <p className='Apps_section_note'>{t('apps.loading')}</p>}
            {error && <p className='Apps_section_note error'>{error}</p>}
            {!loadingTools && !error && !connected && <p className='Apps_section_note'>{t('apps.trek.connections.noMcp')}</p>}
            {connected && (
              <>
                <div className='Gmail_Filters' role='group' aria-label={t('apps.trek.connections.filterLabel')}>
                  {TOOL_FILTERS.map((item) => (
                    <button key={item} type='button' className={filter === item ? 'active' : ''} aria-pressed={filter === item} onClick={() => setFilter(item)}>
                      {t(`apps.trek.connections.filter.${item}`, { count: toolsFor(tools, item).length })}
                    </button>
                  ))}
                </div>
                <Tools_Table tools={toolsFor(tools, filter)} />
              </>
            )}
          </Apps_Section>

          <Apps_Section icon={<Icon.Shield />} title={t('apps.trek.connections.scopesTitle')} description={t('apps.trek.connections.scopesSummary')}>
            <Scopes_Table />
          </Apps_Section>

          <Apps_Section icon={<Icon.Trek />} title={t('apps.trek.connections.restTitle')} description={t('apps.trek.connections.restSummary')}>
            <Rest_Table />
          </Apps_Section>
        </div>
      )}
    </div>
  );
};

export default Trek_Connections;
