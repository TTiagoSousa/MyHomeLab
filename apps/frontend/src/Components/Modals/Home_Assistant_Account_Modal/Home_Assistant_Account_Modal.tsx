import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Home_Assistant_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../App_Location_Fields/App_Location_Fields';

interface Home_Assistant_Account_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
}

const Home_Assistant_Account_Modal = ({ onClose, onSaved }: Home_Assistant_Account_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [displayName, setDisplayName] = useState('');
  const [serverId, setServerId] = useState('');
  const [vmid, setVmid] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const { createHomeAssistantAccount, loading } = useConnectedAccount();

  const canSave = baseUrl.trim().length > 0 && token.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    const success = await createHomeAssistantAccount({
      serverConnectionId: serverId || undefined,
      guestVmid: serverId && vmid ? Number(vmid) : undefined,
      displayName: displayName.trim() || undefined,
      baseUrl: baseUrl.trim(),
      token: token.trim(),
    });
    if (success) onSaved();
  };

  return (
    <div className='Home_Assistant_Account_Modal_Overlay' onClick={onClose}>
      <div className='Home_Assistant_Account_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Home_Assistant_Account_Modal_Title'>{t('homeAssistantModal.title')}</span>

        <div className='Home_Assistant_Account_Modal_Field'>
          <label>{t('homeAssistantModal.name')}</label>
          <Global_Input
            id='home-assistant-account-name'
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('homeAssistantModal.namePlaceholder')}
          />
        </div>

        <div className='Home_Assistant_Account_Modal_Field'>
          <label>{t('homeAssistantModal.url')}</label>
          <Global_Input
            id='home-assistant-account-url'
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={t('homeAssistantModal.urlPlaceholder')}
          />
        </div>

        <div className='Home_Assistant_Account_Modal_Field'>
          <label>{t('homeAssistantModal.token')}</label>
          <Global_Input
            id='home-assistant-account-token'
            type='password'
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t('homeAssistantModal.tokenPlaceholder')}
          />
          <span className='Home_Assistant_Account_Modal_Hint'>{t('homeAssistantModal.hint')}</span>
        </div>

        <div className='Home_Assistant_Account_Modal_Location'>
          <App_Location_Fields
            serverId={serverId}
            vmid={vmid}
            onChange={(nextServerId, nextVmid) => {
              setServerId(nextServerId);
              setVmid(nextVmid);
            }}
            className='Home_Assistant_Account_Modal_Location_Fields'
            fieldClassName='Home_Assistant_Account_Modal_Field'
            errorClassName='Home_Assistant_Account_Modal_Hint error'
          />
          <span className='Home_Assistant_Account_Modal_Hint'>{t('apps.account.location.connectHint')}</span>
        </div>

        <div className='Home_Assistant_Account_Modal_Actions'>
          <button className='Cancel_Button' onClick={onClose} disabled={loading}>
            {t('common:actions.cancel')}
          </button>
          <button className='Save_Button' onClick={handleSave} disabled={loading || !canSave}>
            {t('homeAssistantModal.connect')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home_Assistant_Account_Modal;
