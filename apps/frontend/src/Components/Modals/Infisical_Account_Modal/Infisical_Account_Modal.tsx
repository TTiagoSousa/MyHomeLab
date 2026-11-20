import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Forgejo_Account_Modal/Forgejo_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../App_Location_Fields/App_Location_Fields';

interface Infisical_Account_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
  initialUrl?: string;
}

const Infisical_Account_Modal = ({ onClose, onSaved, initialUrl = '' }: Infisical_Account_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [displayName, setDisplayName] = useState('');
  const [serverId, setServerId] = useState('');
  const [vmid, setVmid] = useState('');
  const [baseUrl, setBaseUrl] = useState(initialUrl);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const { createInfisicalAccount, loading } = useConnectedAccount();

  const canSave = baseUrl.trim().length > 0 && clientId.trim().length >= 8 && clientSecret.trim().length >= 8;

  const handleSave = async () => {
    if (!canSave) return;
    const success = await createInfisicalAccount({
      serverConnectionId: serverId || undefined,
      guestVmid: serverId && vmid ? Number(vmid) : undefined,
      displayName: displayName.trim() || undefined,
      baseUrl: baseUrl.trim(),
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    });
    if (success) onSaved();
  };

  return (
    <div className='Forgejo_Account_Modal_Overlay' onClick={onClose}>
      <div className='Forgejo_Account_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Forgejo_Account_Modal_Title'>{t('infisicalModal.title')}</span>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('infisicalModal.name')}</label>
          <Global_Input id='infisical-account-name' value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('infisicalModal.namePlaceholder')} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('infisicalModal.url')}</label>
          <Global_Input id='infisical-account-url' value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={t('infisicalModal.urlPlaceholder')} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('infisicalModal.clientId')}</label>
          <Global_Input id='infisical-account-client-id' value={clientId} onChange={(e) => setClientId(e.target.value)} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('infisicalModal.clientSecret')}</label>
          <Global_Input id='infisical-account-client-secret' type='password' value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
          <span className='Forgejo_Account_Modal_Hint'>{t('infisicalModal.identityHint')}</span>
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
            {t('infisicalModal.connect')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Infisical_Account_Modal;
