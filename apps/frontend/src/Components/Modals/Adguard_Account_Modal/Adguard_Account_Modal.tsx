import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Adguard_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../App_Location_Fields/App_Location_Fields';

interface Adguard_Account_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
}

const Adguard_Account_Modal = ({ onClose, onSaved }: Adguard_Account_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [displayName, setDisplayName] = useState('');
  const [serverId, setServerId] = useState('');
  const [vmid, setVmid] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { createAdguardAccount, loading } = useConnectedAccount();

  const canSave = baseUrl.trim().length > 0 && username.trim().length > 0 && password.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    const success = await createAdguardAccount({
      serverConnectionId: serverId || undefined,
      guestVmid: serverId && vmid ? Number(vmid) : undefined,
      displayName: displayName.trim() || undefined,
      baseUrl: baseUrl.trim(),
      username: username.trim(),
      password,
    });
    if (success) onSaved();
  };

  return (
    <div className='Adguard_Account_Modal_Overlay' onClick={onClose}>
      <div className='Adguard_Account_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Adguard_Account_Modal_Title'>{t('adguardModal.title')}</span>

        <div className='Adguard_Account_Modal_Field'>
          <label>{t('adguardModal.name')}</label>
          <Global_Input
            id='adguard-account-name'
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('adguardModal.namePlaceholder')}
          />
        </div>

        <div className='Adguard_Account_Modal_Field'>
          <label>{t('adguardModal.url')}</label>
          <Global_Input
            id='adguard-account-url'
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={t('adguardModal.urlPlaceholder')}
          />
        </div>

        <div className='Adguard_Account_Modal_Field'>
          <label>{t('adguardModal.username')}</label>
          <Global_Input
            id='adguard-account-username'
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('adguardModal.usernamePlaceholder')}
          />
        </div>

        <div className='Adguard_Account_Modal_Field'>
          <label>{t('adguardModal.password')}</label>
          <Global_Input
            id='adguard-account-password'
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('adguardModal.password')}
          />
          <span className='Adguard_Account_Modal_Hint'>{t('adguardModal.hint')}</span>
        </div>

        <div className='Adguard_Account_Modal_Location'>
          <App_Location_Fields
            serverId={serverId}
            vmid={vmid}
            onChange={(nextServerId, nextVmid) => {
              setServerId(nextServerId);
              setVmid(nextVmid);
            }}
            className='Adguard_Account_Modal_Location_Fields'
            fieldClassName='Adguard_Account_Modal_Field'
            errorClassName='Adguard_Account_Modal_Hint error'
          />
          <span className='Adguard_Account_Modal_Hint'>{t('apps.account.location.connectHint')}</span>
        </div>

        <div className='Adguard_Account_Modal_Actions'>
          <button className='Cancel_Button' onClick={onClose} disabled={loading}>
            {t('common:actions.cancel')}
          </button>
          <button className='Save_Button' onClick={handleSave} disabled={loading || !canSave}>
            {t('adguardModal.connect')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Adguard_Account_Modal;
