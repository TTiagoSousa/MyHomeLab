import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Server_Modal/Server_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';

const MIN_LENGTH = 10;

interface Instance_Backup_Password_Modal_Props {
  replacing: boolean;
  saving: boolean;
  onSave: (password: string) => Promise<string | null>;
  onClose: () => void;
}

const Instance_Backup_Password_Modal = ({ replacing, saving, onSave, onClose }: Instance_Backup_Password_Modal_Props) => {
  const { t } = useTranslation('admin');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = repeat.length > 0 && repeat !== password;
  const canSave = !saving && password.length >= MIN_LENGTH && repeat === password;

  const handleSave = async () => {
    if (!canSave) return;
    const failure = await onSave(password);
    if (failure) setError(failure);
    else onClose();
  };

  return (
    <div className='Server_Modal_Overlay' onClick={() => !saving && onClose()}>
      <div className='Server_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Server_Modal_Head'>
          <span className='Server_Modal_Mark'>B</span>
          <div>
            <span className='Server_Modal_Title'>{t(replacing ? 'backup.password.changeTitle' : 'backup.password.title')}</span>
            <span className='Server_Modal_Kind'>{t('backup.title')}</span>
          </div>
        </div>

        <p className='Server_Modal_Hint'>{t('backup.password.hint')}</p>
        {replacing && <p className='Server_Modal_Hint'>{t('backup.password.changeHint')}</p>}

        <div className={`Server_Modal_Field${tooShort ? ' invalid' : ''}`}>
          <label htmlFor='instance-backup-password'>{t('backup.password.label')}</label>
          <Global_Input
            id='instance-backup-password'
            type='password'
            autoComplete='new-password'
            value={password}
            placeholder={t('backup.password.placeholder', { count: MIN_LENGTH })}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
          />
        </div>

        <div className={`Server_Modal_Field${mismatch ? ' invalid' : ''}`}>
          <label htmlFor='instance-backup-password-repeat'>{t('backup.password.repeat')}</label>
          <Global_Input
            id='instance-backup-password-repeat'
            type='password'
            autoComplete='new-password'
            value={repeat}
            onChange={(e) => {
              setRepeat(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSave();
            }}
          />
          {mismatch && <span className='Server_Modal_Hint'>{t('backup.password.mismatch')}</span>}
        </div>

        {error && <p className='Server_Modal_Error'>{error}</p>}

        <div className='Server_Modal_Actions'>
          <button type='button' className='Cancel_Button' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </button>
          <button type='button' className='Save_Button' onClick={() => void handleSave()} disabled={!canSave}>
            {t('backup.password.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Instance_Backup_Password_Modal;
