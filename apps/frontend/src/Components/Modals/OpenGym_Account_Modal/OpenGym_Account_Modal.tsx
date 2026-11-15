import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Forgejo_Account_Modal/Forgejo_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../App_Location_Fields/App_Location_Fields';

interface OpenGym_Account_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
  initialUrl?: string;
}

const OpenGym_Account_Modal = ({ onClose, onSaved, initialUrl = '' }: OpenGym_Account_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [displayName, setDisplayName] = useState('');
  const [serverId, setServerId] = useState('');
  const [vmid, setVmid] = useState('');
  const [baseUrl, setBaseUrl] = useState(initialUrl);
  const [code, setCode] = useState('');
  const { createOpenGymAccount, loading } = useConnectedAccount();

  const canSave = baseUrl.trim().length > 0 && code.trim().length === 8;

  const handleSave = async () => {
    if (!canSave) return;
    const success = await createOpenGymAccount({
      serverConnectionId: serverId || undefined,
      guestVmid: serverId && vmid ? Number(vmid) : undefined,
      displayName: displayName.trim() || undefined,
      baseUrl: baseUrl.trim(),
      code: code.trim().toUpperCase(),
    });
    if (success) onSaved();
  };

  return (
    <div className='Forgejo_Account_Modal_Overlay' onClick={onClose}>
      <div className='Forgejo_Account_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Forgejo_Account_Modal_Title'>{t('openGymModal.title')}</span>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('openGymModal.name')}</label>
          <Global_Input id='opengym-account-name' value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('openGymModal.namePlaceholder')} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('openGymModal.url')}</label>
          <Global_Input id='opengym-account-url' value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={t('openGymModal.urlPlaceholder')} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('openGymModal.code')}</label>
          <Global_Input id='opengym-account-code' value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))} placeholder={t('openGymModal.codePlaceholder')} />
          <span className='Forgejo_Account_Modal_Hint'>{t('openGymModal.codeHint')}</span>
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
            {t('openGymModal.connect')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpenGym_Account_Modal;
