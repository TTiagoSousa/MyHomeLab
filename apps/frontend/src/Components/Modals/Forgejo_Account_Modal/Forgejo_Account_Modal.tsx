import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Forgejo_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../App_Location_Fields/App_Location_Fields';

interface Forgejo_Account_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
}

const Forgejo_Account_Modal = ({ onClose, onSaved }: Forgejo_Account_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [displayName, setDisplayName] = useState('');
  const [serverId, setServerId] = useState('');
  const [vmid, setVmid] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const { createForgejoAccount, loading } = useConnectedAccount();

  const canSave = baseUrl.trim().length > 0 && token.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    const success = await createForgejoAccount({
      serverConnectionId: serverId || undefined,
      guestVmid: serverId && vmid ? Number(vmid) : undefined,
      displayName: displayName.trim() || undefined,
      baseUrl: baseUrl.trim(),
      token: token.trim(),
    });
    if (success) onSaved();
  };

  return (
    <div className='Forgejo_Account_Modal_Overlay' onClick={onClose}>
      <div className='Forgejo_Account_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Forgejo_Account_Modal_Title'>{t('forgejoModal.title')}</span>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('forgejoModal.name')}</label>
          <Global_Input
            id='forgejo-account-name'
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('forgejoModal.namePlaceholder')}
          />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('forgejoModal.url')}</label>
          <Global_Input
            id='forgejo-account-url'
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={t('forgejoModal.urlPlaceholder')}
          />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('forgejoModal.token')}</label>
          <Global_Input
            id='forgejo-account-token'
            type='password'
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t('forgejoModal.tokenPlaceholder')}
          />
          <span className='Forgejo_Account_Modal_Hint'>{t('forgejoModal.tokenHint')}</span>
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
            {t('forgejoModal.connect')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Forgejo_Account_Modal;
