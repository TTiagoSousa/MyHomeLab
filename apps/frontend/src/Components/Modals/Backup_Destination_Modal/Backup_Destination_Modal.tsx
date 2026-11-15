import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Server_Modal/Server_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../Inputs/Global_Dropdown/Global_Dropdown';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { accountLabel } from '../../../Hooks/ConnectedAccount/accountLabel';
import type { BackupDestination, BackupDestinationPayload } from '../../../Hooks/Backups/backupTypes';

interface Backup_Destination_Modal_Props {
  existing: BackupDestination | null;
  saving: boolean;
  onSave: (payload: BackupDestinationPayload) => Promise<string | null>;
  onClose: () => void;
}

const GUIDE_STEPS = ['step1', 'step2', 'step3', 'step4'] as const;

const Backup_Destination_Modal = ({ existing, saving, onSave, onClose }: Backup_Destination_Modal_Props) => {
  const { t } = useTranslation('addons');
  const { connectedAccounts: nextcloudAccounts, loading: loadingAccounts } = useConnectedAccounts('NEXTCLOUD');
  const [mode, setMode] = useState<'account' | 'manual' | null>(existing ? (existing.accountId ? 'account' : 'manual') : null);
  const [accountId, setAccountId] = useState(existing?.accountId ?? '');
  const [name, setName] = useState(existing?.name ?? 'Nextcloud');
  const [url, setUrl] = useState(existing?.accountId ? '' : (existing?.url ?? ''));
  const [username, setUsername] = useState(existing?.accountId ? '' : (existing?.username ?? ''));
  const [password, setPassword] = useState('');
  const [folder, setFolder] = useState(existing?.folder ?? 'backups');
  const [error, setError] = useState('');

  const currentMode = mode ?? (loadingAccounts ? null : nextcloudAccounts.length ? 'account' : 'manual');
  const selectedAccount = accountId || nextcloudAccounts[0]?.id || '';
  const urlValid = /^https?:\/\/\S+$/.test(url.trim());
  const manualOk =
    urlValid && username.trim().length > 0 && (existing && !existing.accountId ? true : password.trim().length > 0);
  const canSave =
    !saving &&
    currentMode !== null &&
    name.trim().length > 0 &&
    folder.trim().length > 0 &&
    (currentMode === 'account' ? Boolean(selectedAccount) : manualOk);

  const handleSave = async () => {
    if (!canSave) return;
    setError('');
    const failure = await onSave(
      currentMode === 'account'
        ? { name: name.trim(), accountId: selectedAccount, folder: folder.trim() }
        : {
            name: name.trim(),
            accountId: null,
            url: url.trim(),
            username: username.trim(),
            password: password.trim() || undefined,
            folder: folder.trim(),
          },
    );
    if (failure) setError(failure);
    else onClose();
  };

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: { placeholder?: string; type?: string; hint?: string; invalid?: boolean } = {},
  ) => (
    <div className={`Server_Modal_Field${options.invalid ? ' invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <Global_Input
        id={id}
        type={options.type}
        autoComplete='off'
        value={value}
        placeholder={options.placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setError('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSave();
        }}
      />
      {options.hint && <span className='Server_Modal_Hint'>{options.hint}</span>}
    </div>
  );

  return (
    <div className='Server_Modal_Overlay' onClick={() => !saving && onClose()}>
      <div className='Server_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Server_Modal_Head'>
          <span className='Server_Modal_Mark'>N</span>
          <div>
            <span className='Server_Modal_Title'>
              {existing ? t('backups.modal.editTitle', { name: existing.name }) : t('backups.modal.title')}
            </span>
            <span className='Server_Modal_Kind'>{t('backups.kinds.NEXTCLOUD')}</span>
          </div>
        </div>

        <div className='Server_Modal_Field'>
          <label>{t('backups.modal.source')}</label>
          <div className='Server_Modal_Choices'>
            {(['account', 'manual'] as const).map((option) => (
              <button
                key={option}
                type='button'
                className={currentMode === option ? 'active' : ''}
                disabled={option === 'account' && !nextcloudAccounts.length}
                onClick={() => setMode(option)}
              >
                {t(`backups.modal.sources.${option}`)}
              </button>
            ))}
          </div>
          {!loadingAccounts && !nextcloudAccounts.length && (
            <span className='Server_Modal_Hint'>{t('backups.modal.noAccounts')}</span>
          )}
        </div>

        {currentMode === 'account' && (
          <div className='Server_Modal_Field'>
            <label>{t('backups.modal.account')}</label>
            <Global_Dropdown
              value={selectedAccount}
              options={nextcloudAccounts.map((account) => ({ value: account.id, label: accountLabel(account) }))}
              onChange={setAccountId}
              searchable={false}
            />
            <span className='Server_Modal_Hint'>{t('backups.modal.accountHint')}</span>
          </div>
        )}

        {currentMode === 'manual' && (
        <details className='Server_Modal_Guide' open={!existing}>
          <summary>{t('backups.modal.guide.title')}</summary>
          <ol>
            {GUIDE_STEPS.map((step) => (
              <li key={step}>{t(`backups.modal.guide.${step}`)}</li>
            ))}
          </ol>
          <p>{t('backups.modal.guide.generalOrPerService')}</p>
          <p>{t('backups.modal.guide.safety')}</p>
        </details>
        )}

        {field('backup-destination-name', t('backups.modal.name'), name, setName, {
          placeholder: t('backups.modal.namePlaceholder'),
        })}

        {currentMode === 'manual' && (
          <>
            {field('backup-destination-url', t('backups.modal.url'), url, setUrl, {
              placeholder: 'https://nextcloud.exemplo.com',
              invalid: url.trim().length > 0 && !urlValid,
            })}

            {field('backup-destination-user', t('backups.modal.username'), username, setUsername, {
              placeholder: t('backups.modal.usernamePlaceholder'),
            })}

            {field('backup-destination-password', t('backups.modal.password'), password, setPassword, {
              type: 'password',
              placeholder: existing && !existing.accountId ? t('backups.modal.keepPassword') : 'xxxxx-xxxxx-xxxxx-xxxxx-xxxxx',
              hint: t('backups.modal.passwordHint'),
            })}
          </>
        )}

        {field('backup-destination-folder', t('backups.modal.folder'), folder, setFolder, {
          placeholder: 'backups',
          hint: t('backups.modal.folderHint'),
        })}

        {error && <p className='Server_Modal_Error'>{error}</p>}

        <div className='Server_Modal_Actions'>
          <button type='button' className='Cancel_Button' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </button>
          <button type='button' className='Save_Button' onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? t('backups.modal.testing') : t('backups.modal.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Backup_Destination_Modal;
