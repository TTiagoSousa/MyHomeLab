import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TODO_SYNC_INTERVALS, useTodoSync, type TodoSyncAccount, type TodoSyncGroup } from '../../../Hooks/Todos/useTodoSync';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { formatDateTime } from '../Tasks/taskFormat';
import * as Icon from '../../../Imports/icons';
import Todo_Sync_Group from './Todo_Sync_Group';
import '../../../Components/Modals/Server_Modal/Server_Modal.scss';
import './Todo_Sync.scss';

const NEW_GROUP = '__new';

interface Todo_Sync_Props {
  onClose: () => void;
  onSynced: () => void;
}

const shortLabel = (account: TodoSyncAccount) => (account.provider === 'NEXTCLOUD' ? account.label : account.label.split('@')[0]);

const Todo_Sync = ({ onClose, onSynced }: Todo_Sync_Props) => {
  const { t } = useTranslation('todos');
  const navigate = useNavigate();
  const { overview, remoteLists, busy, fetchRemoteLists, saveSetting, runNow, saveGroup, removeGroup } = useTodoSync();
  const [editing, setEditing] = useState('');

  const after = (done: boolean) => {
    if (done) onSynced();
    return done;
  };

  const intervalLabel = (minutes: number) =>
    minutes < 60 ? t('sync.interval.minutes', { count: minutes }) : minutes < 1440 ? t('sync.interval.hours', { count: minutes / 60 }) : t('sync.interval.day');

  const accountOf = (id: string) => overview?.accounts.find((account) => account.id === id);
  const listName = (id: string) => overview?.lists.find((list) => list.id === id)?.name ?? '';

  const groupState = (group: TodoSyncGroup) => {
    const errors = group.links.filter((link) => link.lastError);
    if (group.lastError || errors.length)
      return (
        <span className='Todo_Sync_State error' title={[group.lastError, ...errors.map((link) => link.lastError)].filter(Boolean).join('\n')}>
          {group.lastError ?? errors[0].lastError}
        </span>
      );
    const last = group.links.map((link) => link.lastSyncAt).filter((date): date is string => Boolean(date)).sort().pop();
    if (!last) return <span className='Todo_Sync_State'>{t('sync.waiting')}</span>;
    const tasks = group.links.reduce((sum, link) => sum + link.tasks, 0);
    return <span className='Todo_Sync_State ok'>{t('sync.syncedAt', { date: formatDateTime(last), count: tasks })}</span>;
  };

  const groupLists = (group: TodoSyncGroup) => {
    const seen = new Map<string, string>();
    for (const link of group.links) {
      const value = (group.includeLocal ? listName(link.listId) : '') || link.remoteListName;
      if (value && !seen.has(value.toLowerCase())) seen.set(value.toLowerCase(), value);
    }
    return [...seen.values()];
  };

  const form = (group: TodoSyncGroup | null) => (
    <Todo_Sync_Group
      key={group?.id ?? NEW_GROUP}
      overview={overview!}
      remoteLists={remoteLists}
      busy={busy}
      group={group}
      onFetchRemote={(accountId) => void fetchRemoteLists(accountId)}
      onSave={(payload) => saveGroup(payload, group?.id).then(after)}
      onCancel={() => setEditing('')}
    />
  );

  const card = (group: TodoSyncGroup) => {
    const lists = groupLists(group);
    return (
      <section key={group.id} className='Todo_Sync_Group'>
        <header>
          <span className='Todo_Sync_Group_Name'>{group.name}</span>
          <div className='Todo_Sync_Group_Actions'>
            <button type='button' disabled={busy || Boolean(editing)} onClick={() => setEditing(group.id)}>
              <Icon.Pencil />
              {t('sync.group.edit')}
            </button>
            <button
              type='button'
              className='Todo_Sync_Remove'
              disabled={busy || Boolean(editing)}
              onClick={() => void removeGroup(group.id).then(after)}
              title={t('sync.remove')}
              aria-label={t('sync.remove')}
            >
              <Icon.Close />
            </button>
          </div>
        </header>
        <div className='Todo_Sync_Group_Body'>
          <div className='Todo_Sync_Line'>
            <span className='Todo_Sync_Label'>{t('sync.group.where')}</span>
            <span className='Todo_Sync_Tags'>
              {group.includeLocal && (
                <span className='Todo_Sync_Account_Tag local'>
                  <Icon.HomeLab />
                  {t('sync.group.localShort')}
                </span>
              )}
              {group.accountIds.flatMap((id) => {
                const account = accountOf(id);
                if (!account) return [];
                return [
                  <span key={id} className='Todo_Sync_Account_Tag' title={account.label}>
                    {account.provider === 'NEXTCLOUD' ? <Icon.Nextcloud /> : <Icon.GoogleTasks />}
                    {shortLabel(account)}
                  </span>,
                ];
              })}
            </span>
          </div>
          <div className='Todo_Sync_Line'>
            <span className='Todo_Sync_Label'>{t('sync.group.what')}</span>
            <span className='Todo_Sync_Summary'>
              {group.scope === 'ALL' ? t('sync.group.allSummary', { count: lists.length }) : t('sync.group.someSummary', { count: lists.length })}
              {lists.length > 0 && <small>{lists.join(' · ')}</small>}
            </span>
          </div>
          <div className='Todo_Sync_Line'>
            <span className='Todo_Sync_Label'>{t('sync.group.state')}</span>
            {groupState(group)}
          </div>
        </div>
      </section>
    );
  };

  const renderGroups = () => {
    if (!overview) return <p className='Todo_Sync_Note'>{t('loading')}</p>;
    if (!overview.accounts.length) {
      return (
        <div className='Todo_Sync_Empty'>
          <p>{t('sync.noAccount')}</p>
          <div className='Todo_Sync_Empty_Actions'>
            <button type='button' className='Save_Button' onClick={() => navigate('/MyHomeLab/Apps/GoogleTasks')}>
              {t('sync.connectGoogle')}
            </button>
            <button type='button' className='Save_Button' onClick={() => navigate('/MyHomeLab/Apps/Nextcloud')}>
              {t('sync.connectNextcloud')}
            </button>
          </div>
        </div>
      );
    }
    return (
      <>
        {!overview.groups.length && editing !== NEW_GROUP && <p className='Todo_Sync_Note'>{t('sync.nothingYet')}</p>}
        {overview.groups.map((group) => (editing === group.id ? form(group) : card(group)))}
        {editing === NEW_GROUP ? (
          form(null)
        ) : (
          <button type='button' className='Todo_Sync_Add_Button' onClick={() => setEditing(NEW_GROUP)} disabled={busy || Boolean(editing)}>
            <Icon.Plus />
            {t('sync.group.add')}
          </button>
        )}
      </>
    );
  };

  return (
    <div className='Server_Modal_Overlay' onClick={() => !busy && onClose()}>
      <div className='Server_Modal Todo_Sync' onClick={(e) => e.stopPropagation()}>
        <div className='Server_Modal_Head'>
          <span className='Server_Modal_Mark'>
            <Icon.Refresh />
          </span>
          <div>
            <span className='Server_Modal_Title'>{t('sync.title')}</span>
            <span className='Server_Modal_Kind'>{t('sync.kind')}</span>
          </div>
        </div>

        {overview && (
          <div className='Todo_Sync_Settings'>
            <label className='Todo_Sync_Switch'>
              <input type='checkbox' checked={overview.enabled} disabled={busy} onChange={(e) => void saveSetting({ enabled: e.target.checked })} />
              <span>{overview.enabled ? t('sync.on') : t('sync.off')}</span>
            </label>
            <label className='Todo_Sync_Interval'>
              <span>{t('sync.interval.label')}</span>
              <Global_Dropdown
                value={String(overview.intervalMinutes)}
                options={TODO_SYNC_INTERVALS.map((minutes) => ({ value: String(minutes), label: intervalLabel(minutes) }))}
                searchable={false}
                disabled={busy}
                onChange={(value) => void saveSetting({ intervalMinutes: Number(value) })}
              />
            </label>
            <span className='Todo_Sync_Last'>{overview.lastRunAt ? t('sync.lastRun', { date: formatDateTime(overview.lastRunAt) }) : t('sync.never')}</span>
            <button
              type='button'
              className='Todo_Sync_Run'
              disabled={busy || !overview.groups.length}
              onClick={() => void runNow().then(after)}
            >
              <Icon.Refresh />
              {t('sync.runNow')}
            </button>
          </div>
        )}

        <span className='Todo_Sync_Section'>{t('sync.groups')}</span>
        {renderGroups()}

        <span className='Server_Modal_Hint'>{t('sync.rules')}</span>

        <div className='Server_Modal_Actions'>
          <button type='button' className='Save_Button' onClick={onClose} disabled={busy}>
            {t('sync.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Todo_Sync;
