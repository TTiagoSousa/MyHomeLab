import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Forgejo_Account_Modal/Forgejo_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../App_Location_Fields/App_Location_Fields';

interface Vaultwarden_Account_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
  initialUrl?: string;
}

const Vaultwarden_Account_Modal = ({ onClose, onSaved, initialUrl = '' }: Vaultwarden_Account_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [displayName, setDisplayName] = useState('');
  const [serverId, setServerId] = useState('');
  const [vmid, setVmid] = useState('');
  const [baseUrl, setBaseUrl] = useState(initialUrl);
  const [adminToken, setAdminToken] = useState('');
  const { createVaultwardenAccount, loading } = useConnectedAccount();

  const canSave = baseUrl.trim().length > 0 && adminToken.trim().length >= 8;

  const handleSave = async () => {
    if (!canSave) return;
    const success = await createVaultwardenAccount({
      serverConnectionId: serverId || undefined,
      guestVmid: serverId && vmid ? Number(vmid) : undefined,
      displayName: displayName.trim() || undefined,
      baseUrl: baseUrl.trim(),
      adminToken: adminToken.trim(),
    });
    if (success) onSaved();
  };

  return (
    <div className='Forgejo_Account_Modal_Overlay' onClick={onClose}>
      <div className='Forgejo_Account_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Forgejo_Account_Modal_Title'>{t('vaultwardenModal.title')}</span>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('vaultwardenModal.name')}</label>
          <Global_Input id='vaultwarden-account-name' value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('vaultwardenModal.namePlaceholder')} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('vaultwardenModal.url')}</label>
          <Global_Input id='vaultwarden-account-url' value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={t('vaultwardenModal.urlPlaceholder')} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('vaultwardenModal.adminToken')}</label>
          <Global_Input id='vaultwarden-account-token' type='password' value={adminToken} onChange={(e) => setAdminToken(e.target.value)} />
          <span className='Forgejo_Account_Modal_Hint'>{t('vaultwardenModal.adminTokenHint')}</span>
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
            {t('vaultwardenModal.connect')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Vaultwarden_Account_Modal;
