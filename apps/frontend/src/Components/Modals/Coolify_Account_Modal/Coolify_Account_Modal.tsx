import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Forgejo_Account_Modal/Forgejo_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../App_Location_Fields/App_Location_Fields';

interface Coolify_Account_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
  initialUrl?: string;
}

const Coolify_Account_Modal = ({ onClose, onSaved, initialUrl = '' }: Coolify_Account_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [displayName, setDisplayName] = useState('');
  const [serverId, setServerId] = useState('');
  const [vmid, setVmid] = useState('');
  const [baseUrl, setBaseUrl] = useState(initialUrl);
  const [apiToken, setApiToken] = useState('');
  const { createCoolifyAccount, loading } = useConnectedAccount();

  const canSave = baseUrl.trim().length > 0 && apiToken.trim().length >= 10;

  const handleSave = async () => {
    if (!canSave) return;
    const success = await createCoolifyAccount({
      serverConnectionId: serverId || undefined,
      guestVmid: serverId && vmid ? Number(vmid) : undefined,
      displayName: displayName.trim() || undefined,
      baseUrl: baseUrl.trim(),
      apiToken: apiToken.trim(),
    });
    if (success) onSaved();
  };

  return (
    <div className='Forgejo_Account_Modal_Overlay' onClick={onClose}>
      <div className='Forgejo_Account_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Forgejo_Account_Modal_Title'>{t('coolifyModal.title')}</span>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('coolifyModal.name')}</label>
          <Global_Input id='coolify-account-name' value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('coolifyModal.namePlaceholder')} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('coolifyModal.url')}</label>
          <Global_Input id='coolify-account-url' value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={t('coolifyModal.urlPlaceholder')} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('coolifyModal.apiToken')}</label>
          <Global_Input id='coolify-account-token' type='password' value={apiToken} onChange={(e) => setApiToken(e.target.value)} />
          <span className='Forgejo_Account_Modal_Hint'>{t('coolifyModal.apiTokenHint')}</span>
        </div>

        <div className='Forgejo_Account_Modal_Location'>
          <App_Location_Fields
            serverId={serverId}
            vmid={vmid}
            onChange={(nextServerId, nextVmid) => {
              setServerId(nextServerId);
              setVmid(nextVmid);
            }}
            className='Forgejo_Account_Modal_Location_Fields'
            fieldClassName='Forgejo_Account_Modal_Field'
            errorClassName='Forgejo_Account_Modal_Hint error'
          />
          <span className='Forgejo_Account_Modal_Hint'>{t('apps.account.location.connectHint')}</span>
        </div>

        <div className='Forgejo_Account_Modal_Actions'>
          <button className='Cancel_Button' onClick={onClose} disabled={loading}>
            {t('common:actions.cancel')}
          </button>
          <button className='Save_Button' onClick={handleSave} disabled={loading || !canSave}>
            {t('coolifyModal.connect')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Coolify_Account_Modal;
