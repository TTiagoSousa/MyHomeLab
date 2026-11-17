import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Server_Modal/Server_Modal.scss';
import './Instance_Restore_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useInstanceRestore } from '../../../Hooks/Backups/useInstanceRestore';
import { dateLocale } from '../../../i18n';

const CONFIRM_WORD = 'REPOR';

interface Instance_Restore_Modal_Props {
  onClose: () => void;
}

const Instance_Restore_Modal = ({ onClose }: Instance_Restore_Modal_Props) => {
  const { t } = useTranslation('admin');
  const { status, uploading, progress, waiting, active, restore } = useInstanceRestore();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const started = Boolean(status && status.state !== 'idle');
  const busy = uploading || active;
  const canRestore = !busy && Boolean(file) && password.length > 0 && confirm.trim().toUpperCase() === CONFIRM_WORD;

  const handleRestore = async () => {
    if (!file || !canRestore) return;
    setError('');
    const failure = await restore(file, password);
    if (failure) setError(failure);
  };

  const backupDate = status?.backupCreatedAt ? new Date(status.backupCreatedAt).toLocaleString(dateLocale()) : null;

  return (
    <div className='Server_Modal_Overlay' onClick={() => !busy && onClose()}>
      <div className='Server_Modal Instance_Restore_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Server_Modal_Head'>
          <span className='Server_Modal_Mark'>R</span>
          <div>
            <span className='Server_Modal_Title'>{t('backup.restore.title')}</span>
            <span className='Server_Modal_Kind'>{t('backup.title')}</span>
          </div>
        </div>

        {!started ? (
          <>
            <p className='Instance_Restore_Warning'>{t('backup.restore.warning')}</p>
            <p className='Server_Modal_Hint'>{t('backup.restore.safety')}</p>

            <div className='Server_Modal_Field'>
              <label htmlFor='instance-restore-file'>{t('backup.restore.file')}</label>
              <input
                id='instance-restore-file'
                className='Instance_Restore_File'
                type='file'
                accept='.zip'
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setError('');
                }}
              />
            </div>

            <div className='Server_Modal_Field'>
              <label htmlFor='instance-restore-password'>{t('backup.restore.password')}</label>
              <Global_Input
                id='instance-restore-password'
                type='password'
                autoComplete='off'
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
              />
            </div>

            <div className='Server_Modal_Field'>
              <label htmlFor='instance-restore-confirm'>{t('backup.restore.confirm', { word: CONFIRM_WORD })}</label>
              <Global_Input id='instance-restore-confirm' autoComplete='off' value={confirm} placeholder={CONFIRM_WORD} onChange={(e) => setConfirm(e.target.value)} />
            </div>

            {uploading && <p className='Server_Modal_Hint'>{t('backup.restore.uploading', { progress })}</p>}
            {error && <p className='Server_Modal_Error'>{error}</p>}

            <div className='Server_Modal_Actions'>
              <button type='button' className='Cancel_Button' onClick={onClose} disabled={uploading}>
                {t('common:actions.cancel')}
              </button>
              <button type='button' className='Save_Button danger' onClick={() => void handleRestore()} disabled={!canRestore}>
                {uploading ? t('backup.restore.checking') : t('backup.restore.start')}
              </button>
            </div>
          </>
        ) : (
          <>
            {backupDate && <p className='Server_Modal_Hint'>{t('backup.restore.from', { date: backupDate })}</p>}
            <div className={`Instance_Restore_State ${status!.state}`}>
              <strong>{t(`backup.restore.states.${status!.state}`)}</strong>
              {status!.step && active && <span>{t(`backup.restore.steps.${status!.step}`, { defaultValue: status!.step })}</span>}
              {status!.message && !active && <span>{status!.message}</span>}
              {waiting && <span>{t('backup.restore.waiting')}</span>}
            </div>
            {status!.log.length > 0 && <pre className='Instance_Restore_Log'>{status!.log.slice(-12).join('\n')}</pre>}

            <div className='Server_Modal_Actions'>
              {status!.state === 'success' ? (
                <button type='button' className='Save_Button' onClick={() => window.location.assign('/')}>
                  {t('backup.restore.signIn')}
                </button>
              ) : (
                <button type='button' className='Cancel_Button' onClick={onClose} disabled={active}>
                  {t('common:actions.close')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Instance_Restore_Modal;
