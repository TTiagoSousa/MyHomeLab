import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Forgejo_Account_Modal/Forgejo_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../App_Location_Fields/App_Location_Fields';

interface Dispatcharr_Account_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
  initialUrl?: string;
}

const Dispatcharr_Account_Modal = ({ onClose, onSaved, initialUrl = '' }: Dispatcharr_Account_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [displayName, setDisplayName] = useState('');
  const [serverId, setServerId] = useState('');
  const [vmid, setVmid] = useState('');
  const [baseUrl, setBaseUrl] = useState(initialUrl);
  const [apiKey, setApiKey] = useState('');
  const { createDispatcharrAccount, loading } = useConnectedAccount();

  const canSave = baseUrl.trim().length > 0 && apiKey.trim().length >= 10;

  const handleSave = async () => {
    if (!canSave) return;
    const success = await createDispatcharrAccount({
      serverConnectionId: serverId || undefined,
      guestVmid: serverId && vmid ? Number(vmid) : undefined,
      displayName: displayName.trim() || undefined,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
    });
    if (success) onSaved();
  };

  return (
    <div className='Forgejo_Account_Modal_Overlay' onClick={onClose}>
      <div className='Forgejo_Account_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Forgejo_Account_Modal_Title'>{t('dispatcharrModal.title')}</span>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('dispatcharrModal.name')}</label>
          <Global_Input id='dispatcharr-account-name' value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('dispatcharrModal.namePlaceholder')} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('dispatcharrModal.url')}</label>
          <Global_Input id='dispatcharr-account-url' value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={t('dispatcharrModal.urlPlaceholder')} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('dispatcharrModal.apiKey')}</label>
          <Global_Input id='dispatcharr-account-key' type='password' value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          <span className='Forgejo_Account_Modal_Hint'>{t('dispatcharrModal.apiKeyHint')}</span>
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
            {t('dispatcharrModal.connect')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dispatcharr_Account_Modal;
