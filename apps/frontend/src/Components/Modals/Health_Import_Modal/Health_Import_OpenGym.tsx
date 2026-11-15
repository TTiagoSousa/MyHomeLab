import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RunFrequency } from '@myhomelab/shared';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../Inputs/Global_Dropdown/Global_Dropdown';
import { FREQUENCY_OPTIONS } from '../../../Constants/runFrequency';
import type { useOpenGym } from '../../../Hooks/Health/useOpenGym';
import { dateLocale } from '../../../i18n';
import Health_OpenGym_Status from './Health_OpenGym_Status';
import OpenGym_Account_Modal from '../OpenGym_Account_Modal/OpenGym_Account_Modal';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';

interface Health_Import_OpenGym_Props {
  openGym: ReturnType<typeof useOpenGym>;
  onSynced: () => void;
  onClose: () => void;
}

const DEFAULT_URL = 'https://';

const whenLabel = (iso: string) =>
  new Date(iso).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const Health_Import_OpenGym = ({ openGym, onSynced, onClose }: Health_Import_OpenGym_Props) => {
  const { t } = useTranslation('health');
  const { connection, status, loading, busy, fetchStatus, connect, connectApp, updateSettings, syncNow, disconnect } = openGym;
  const { connectedAccounts: apps, loading: loadingApps, fetchConnectedAccounts } = useConnectedAccounts('OPENGYM');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_URL);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [pairOnly, setPairOnly] = useState(false);
  const [connectingApp, setConnectingApp] = useState(false);

  if (loading || (!connection?.connected && loadingApps)) {
    return (
      <div className='Health_Import_Modal_Body'>
        <span className='Health_Import_Modal_Info'>{t('loading')}</span>
      </div>
    );
  }

  const closeButton = (
    <button type='button' className='Health_Import_Modal_Close' onClick={onClose} disabled={busy}>
      {t('import.close')}
    </button>
  );

  if (!connection?.connected && !pairOnly) {
    const activeApps = apps.filter((app) => app.isActive);
    const handleUseApp = async (accountId: string) => {
      setError('');
      const failure = await connectApp(accountId);
      if (failure) setError(failure);
      else onSynced();
    };

    return (
      <>
        <div className='Health_Import_Modal_Body'>
          <span className='Health_Import_Modal_Text'>{activeApps.length ? t('import.openGym.useAppHelp') : t('import.openGym.noAppHelp')}</span>
          <div className='Health_Import_OpenGym_Choices'>
            {activeApps.map((app) => (
              <button key={app.id} type='button' className='Health_Import_OpenGym_Choice' disabled={busy} onClick={() => void handleUseApp(app.id)}>
                <strong>{t('import.openGym.useApp', { name: app.displayName ?? 'openGym' })}</strong>
                <span>{app.appHost}</span>
              </button>
            ))}
            {!activeApps.length && (
              <button type='button' className='Health_Import_OpenGym_Choice' disabled={busy} onClick={() => setConnectingApp(true)}>
                <strong>{t('import.openGym.connectApp')}</strong>
                <span>{t('import.openGym.connectAppHint')}</span>
              </button>
            )}
            <button type='button' className='Health_Import_OpenGym_Choice' disabled={busy} onClick={() => setPairOnly(true)}>
              <strong>{t('import.openGym.pairOnly')}</strong>
              <span>{t('import.openGym.pairOnlyHint')}</span>
            </button>
          </div>
          {busy && <span className='Health_Import_Modal_Info'>{t('import.openGym.connecting')}</span>}
          {error && <span className='Health_Import_Modal_Info error'>{error}</span>}
        </div>

        <div className='Health_Import_Modal_Footer'>{closeButton}</div>

        {connectingApp && (
          <OpenGym_Account_Modal
            onClose={() => setConnectingApp(false)}
            onSaved={() => {
              setConnectingApp(false);
              fetchConnectedAccounts();
            }}
          />
        )}
      </>
    );
  }

  if (!connection?.connected) {
    const canConnect = !busy && baseUrl.trim().length > DEFAULT_URL.length && code.trim().length === 8;
    const handleConnect = async () => {
      if (!canConnect) return;
      setError('');
      const failure = await connect(baseUrl.trim(), code.trim());
      if (failure) setError(failure);
      else onSynced();
    };

    return (
      <>
      <div className='Health_Import_Modal_Body'>
        <span className='Health_Import_Modal_Text'>{t('import.openGym.help')}</span>
        <div className='Health_Import_OpenGym_Fields'>
          <div className='Health_Import_OpenGym_Field'>
            <label htmlFor='opengym-url'>{t('import.openGym.url')}</label>
            <Global_Input
              id='opengym-url'
              value={baseUrl}
              placeholder='https://opengym.exemplo.com'
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
          <div className='Health_Import_OpenGym_Field'>
            <label htmlFor='opengym-code'>{t('import.openGym.code')}</label>
            <Global_Input
              id='opengym-code'
              value={code}
              maxLength={8}
              autoComplete='off'
              placeholder='K7WQ2MZP'
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </div>
        </div>
        {error && <span className='Health_Import_Modal_Info error'>{error}</span>}
      </div>

      <div className='Health_Import_Modal_Footer'>
        <button type='button' className='Health_Import_Modal_Close Health_Import_Modal_Footer_left' disabled={busy} onClick={() => setPairOnly(false)}>
          {t('import.openGym.back')}
        </button>
        {closeButton}
        <button type='button' className='Health_Import_Modal_Submit' disabled={!canConnect} onClick={() => void handleConnect()}>
          {busy ? t('import.openGym.connecting') : t('import.openGym.connect')}
        </button>
      </div>
      </>
    );
  }

  const handleSync = async () => {
    if (await syncNow()) onSynced();
  };

  const handleDisconnect = async () => {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    await disconnect();
    setConfirmDisconnect(false);
  };

  return (
    <>
    <div className='Health_Import_Modal_Body'>
      <div className='Health_Import_OpenGym_Connection'>
        <div className='Health_Import_OpenGym_Connection_main'>
          <Health_OpenGym_Status status={status} />
          <span className='Health_Import_OpenGym_Connection_url'>{connection.baseUrl?.replace(/^https?:\/\//, '')}</span>
          <span className='Health_Import_OpenGym_Connection_meta'>
            {connection.accountId ? t('import.openGym.viaApp', { name: connection.appName ?? 'openGym' }) : t('import.openGym.viaPairing')}
            {' · '}
            {connection.accountName ?? '—'}
            {' · '}
            {t('import.openGym.workouts', { count: connection.workouts ?? 0 })}
            {connection.lastSuccessAt ? ` · ${t('import.openGym.lastSync', { when: whenLabel(connection.lastSuccessAt) })}` : ''}
          </span>
        </div>
        <button type='button' className='Health_Import_OpenGym_Check' disabled={busy || !status} onClick={() => void fetchStatus()}>
          {t('import.openGym.check')}
        </button>
      </div>

      {status && !status.online && status.error && <span className='Health_Import_Modal_Info error'>{status.error}</span>}
      {connection.sync && !connection.sync.unchanged && (
        <span className='Health_Import_Modal_Info success'>
          {t('import.openGym.result', {
            created: connection.sync.created,
            updated: connection.sync.updated,
            deleted: connection.sync.deleted,
            heart: connection.sync.heart,
            linked: connection.sync.linked,
          })}
        </span>
      )}
      {connection.sync?.unchanged && <span className='Health_Import_Modal_Info'>{t('import.openGym.unchanged')}</span>}
      {connection.lastError && <span className='Health_Import_Modal_Info error'>{connection.lastError}</span>}

      <div className='Health_Import_OpenGym_Settings'>
        <label className='Health_Import_OpenGym_Toggle'>
          <input
            type='checkbox'
            checked={connection.isActive ?? true}
            onChange={(e) => void updateSettings({ isActive: e.target.checked })}
          />
          {t('import.openGym.auto')}
        </label>
        <div className='Health_Import_OpenGym_Field'>
          <label htmlFor='opengym-frequency'>{t('import.openGym.frequency')}</label>
          <Global_Dropdown
            id='opengym-frequency'
            value={connection.runFrequency ?? 'EVERY_30_MINUTES'}
            searchable={false}
            disabled={connection.isActive === false}
            options={FREQUENCY_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
            onChange={(value) => void updateSettings({ runFrequency: value as RunFrequency })}
          />
        </div>
      </div>

      <span className='Health_Import_Modal_Text'>{t('import.openGym.matchHint')}</span>
    </div>

    <div className='Health_Import_Modal_Footer'>
      <button
        type='button'
        className={`Health_Import_Modal_Close Health_Import_Modal_Footer_left${confirmDisconnect ? ' danger' : ''}`}
        disabled={busy}
        onClick={() => void handleDisconnect()}
        onBlur={() => setConfirmDisconnect(false)}
      >
        {confirmDisconnect
          ? t(connection.accountId ? 'import.openGym.confirmStopApp' : 'import.openGym.confirmDisconnect')
          : t(connection.accountId ? 'import.openGym.stopApp' : 'import.openGym.disconnect')}
      </button>
      {closeButton}
      <button type='button' className='Health_Import_Modal_Submit' disabled={busy} onClick={() => void handleSync()}>
        {busy ? t('import.openGym.syncing') : t('import.openGym.syncNow')}
      </button>
    </div>
    </>
  );
};

export default Health_Import_OpenGym;
