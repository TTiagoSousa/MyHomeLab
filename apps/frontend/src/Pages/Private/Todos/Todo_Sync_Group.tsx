import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RemoteTaskList, TodoSyncGroup, TodoSyncGroupPayload, TodoSyncOverview, TodoSyncScope } from '../../../Hooks/Todos/useTodoSync';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import * as Icon from '../../../Imports/icons';

interface Todo_Sync_Group_Props {
  overview: TodoSyncOverview;
  remoteLists: Record<string, RemoteTaskList[]>;
  busy: boolean;
  group: TodoSyncGroup | null;
  onFetchRemote: (accountId: string) => void;
  onSave: (group: TodoSyncGroupPayload) => Promise<boolean>;
  onCancel: () => void;
}

const key = (name: string) => name.trim().toLowerCase();

const Todo_Sync_Group = ({ overview, remoteLists, busy, group, onFetchRemote, onSave, onCancel }: Todo_Sync_Group_Props) => {
  const { t } = useTranslation('todos');
  const [name, setName] = useState(group?.name ?? '');
  const [accountIds, setAccountIds] = useState<string[]>(group?.accountIds ?? []);
  const [scope, setScope] = useState<TodoSyncScope>(group?.scope ?? 'ALL');
  const [includeLocal, setIncludeLocal] = useState(group?.includeLocal ?? true);
  const [listNames, setListNames] = useState<string[]>(group?.listNames ?? []);
  const [extra, setExtra] = useState('');

  useEffect(() => {
    for (const id of accountIds) if (!remoteLists[id]) onFetchRemote(id);
  }, []);

  const toggleAccount = (id: string) => {
    if (accountIds.includes(id)) return setAccountIds(accountIds.filter((item) => item !== id));
    setAccountIds([...accountIds, id]);
    if (!remoteLists[id]) onFetchRemote(id);
  };

  const available = (() => {
    const seen = new Map<string, string>();
    const add = (value: string) => {
      if (value.trim() && !seen.has(key(value))) seen.set(key(value), value.trim());
    };
    if (includeLocal) overview.lists.forEach((list) => add(list.name));
    accountIds.forEach((id) => (remoteLists[id] ?? []).forEach((list) => add(list.title)));
    listNames.forEach(add);
    return [...seen.values()];
  })();

  const chosen = new Set(listNames.map(key));
  const toggleName = (value: string) =>
    setListNames(chosen.has(key(value)) ? listNames.filter((item) => key(item) !== key(value)) : [...listNames, value]);

  const addExtra = () => {
    const value = extra.trim();
    if (!value) return;
    if (!chosen.has(key(value))) setListNames([...listNames, value]);
    setExtra('');
  };

  const loading = accountIds.some((id) => !remoteLists[id]);
  const places = accountIds.length + (includeLocal ? 1 : 0);
  const canSave = Boolean(name.trim()) && accountIds.length > 0 && places >= 2 && (scope === 'ALL' || listNames.length > 0);

  const save = async () => {
    const done = await onSave({ name: name.trim(), scope, includeLocal, listNames: scope === 'LISTS' ? listNames : [], accountIds });
    if (done) onCancel();
  };

  return (
    <div className='Todo_Sync_Group_Form'>
      <span className='Todo_Sync_Form_Title'>{group ? t('sync.group.editTitle') : t('sync.group.newTitle')}</span>

      <div className='Todo_Sync_Step'>
        <span>{t('sync.group.name')}</span>
        <Global_Input id='todo-sync-group-name' value={name} maxLength={60} placeholder={t('sync.group.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className='Todo_Sync_Step'>
        <span>{t('sync.group.where')}</span>
        <div className='Todo_Sync_Checks'>
          <label className={`Todo_Sync_Check local${includeLocal ? ' on' : ''}`}>
            <input type='checkbox' checked={includeLocal} onChange={() => setIncludeLocal(!includeLocal)} />
            <Icon.HomeLab />
            <span>{t('sync.group.local')}</span>
          </label>
          {overview.accounts.map((account) => (
            <label key={account.id} className={`Todo_Sync_Check${accountIds.includes(account.id) ? ' on' : ''}`}>
              <input type='checkbox' checked={accountIds.includes(account.id)} onChange={() => toggleAccount(account.id)} />
              {account.provider === 'NEXTCLOUD' ? <Icon.Nextcloud /> : <Icon.GoogleTasks />}
              <span>{account.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className='Todo_Sync_Step'>
        <span>{t('sync.group.what')}</span>
        <div className='Todo_Sync_Scope'>
          <label className={`Todo_Sync_Option${scope === 'ALL' ? ' on' : ''}`}>
            <input type='radio' name='todo-sync-scope' checked={scope === 'ALL'} onChange={() => setScope('ALL')} />
            <span>
              <strong>{t('sync.group.all')}</strong>
              <small>{t('sync.group.allHint')}</small>
            </span>
          </label>
          <label className={`Todo_Sync_Option${scope === 'LISTS' ? ' on' : ''}`}>
            <input type='radio' name='todo-sync-scope' checked={scope === 'LISTS'} onChange={() => setScope('LISTS')} />
            <span>
              <strong>{t('sync.group.some')}</strong>
              <small>{t('sync.group.someHint')}</small>
            </span>
          </label>

          {scope === 'LISTS' && (
            <div className='Todo_Sync_Names'>
              {loading && <span className='Todo_Sync_Note'>{t('loading')}</span>}
              <div className='Todo_Sync_Checks'>
                {available.map((value) => (
                  <label key={key(value)} className={`Todo_Sync_Check${chosen.has(key(value)) ? ' on' : ''}`}>
                    <input type='checkbox' checked={chosen.has(key(value))} onChange={() => toggleName(value)} />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
              <div className='Todo_Sync_Extra'>
                <Global_Input
                  id='todo-sync-extra-list'
                  value={extra}
                  maxLength={60}
                  placeholder={t('sync.group.newList')}
                  onChange={(e) => setExtra(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addExtra()}
                />
                <button type='button' className='Todo_Sync_Add_Member' onClick={addExtra} disabled={!extra.trim()}>
                  <Icon.Plus />
                  {t('sync.group.addList')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {accountIds.length > 0 && places < 2 && <p className='Todo_Sync_Note warn'>{t('sync.group.needTwo')}</p>}
      <p className='Todo_Sync_Note'>{includeLocal ? t('sync.group.hint') : t('sync.group.hintNoLocal')}</p>

      <div className='Todo_Sync_Form_Actions'>
        <button type='button' className='Cancel_Button' onClick={onCancel} disabled={busy}>
          {t('cancel')}
        </button>
        <button type='button' className='Save_Button' onClick={() => void save()} disabled={busy || !canSave}>
          {t('save')}
        </button>
      </div>
    </div>
  );
};

export default Todo_Sync_Group;
