import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Trek_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../App_Location_Fields/App_Location_Fields';

interface Trek_Account_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
}

const Trek_Account_Modal = ({ onClose, onSaved }: Trek_Account_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [displayName, setDisplayName] = useState('');
  const [serverId, setServerId] = useState('');
  const [vmid, setVmid] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mcpClientId, setMcpClientId] = useState('');
  const [mcpClientSecret, setMcpClientSecret] = useState('');
  const { createTrekAccount, loading } = useConnectedAccount();

  const canSave = baseUrl.trim().length > 0 && email.trim().length > 0 && password.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    const success = await createTrekAccount({
      serverConnectionId: serverId || undefined,
      guestVmid: serverId && vmid ? Number(vmid) : undefined,
      displayName: displayName.trim() || undefined,
      mcpClientId: mcpClientId.trim() || undefined,
      mcpClientSecret: mcpClientSecret.trim() || undefined,
      baseUrl: baseUrl.trim(),
      email: email.trim(),
      password,
    });
    if (success) onSaved();
  };

  return (
    <div className='Trek_Account_Modal_Overlay' onClick={onClose}>
      <div className='Trek_Account_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Trek_Account_Modal_Title'>{t('trekModal.title')}</span>

        <div className='Trek_Account_Modal_Field'>
          <label>{t('trekModal.name')}</label>
          <Global_Input
            id='trek-account-name'
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('trekModal.namePlaceholder')}
          />
        </div>

        <div className='Trek_Account_Modal_Field'>
          <label>{t('trekModal.url')}</label>
          <Global_Input
            id='trek-account-url'
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={t('trekModal.urlPlaceholder')}
          />
        </div>

        <div className='Trek_Account_Modal_Field'>
          <label>{t('trekModal.email')}</label>
          <Global_Input
            id='trek-account-email'
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('trekModal.emailPlaceholder')}
          />
        </div>

        <div className='Trek_Account_Modal_Field'>
          <label>{t('trekModal.password')}</label>
          <Global_Input
            id='trek-account-password'
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('trekModal.password')}
          />
          <span className='Trek_Account_Modal_Hint'>{t('trekModal.hint')}</span>
        </div>

        <div className='Trek_Account_Modal_Field'>
          <label>{t('trekModal.mcpClientId')}</label>
          <Global_Input id='trek-account-mcp-id' value={mcpClientId} onChange={(e) => setMcpClientId(e.target.value)} placeholder='client_id' />
        </div>

        <div className='Trek_Account_Modal_Field'>
          <label>{t('trekModal.mcpClientSecret')}</label>
          <Global_Input
            id='trek-account-mcp-secret'
            type='password'
            value={mcpClientSecret}
            onChange={(e) => setMcpClientSecret(e.target.value)}
            placeholder='trekcs_…'
          />
          <span className='Trek_Account_Modal_Hint'>{t('trekModal.mcpHint')}</span>
        </div>

        <div className='Trek_Account_Modal_Location'>
          <App_Location_Fields
            serverId={serverId}
            vmid={vmid}
            onChange={(nextServerId, nextVmid) => {
              setServerId(nextServerId);
              setVmid(nextVmid);
            }}
            className='Trek_Account_Modal_Location_Fields'
            fieldClassName='Trek_Account_Modal_Field'
            errorClassName='Trek_Account_Modal_Hint error'
          />
          <span className='Trek_Account_Modal_Hint'>{t('apps.account.location.connectHint')}</span>
        </div>

        <div className='Trek_Account_Modal_Actions'>
          <button className='Cancel_Button' onClick={onClose} disabled={loading}>
            {t('common:actions.cancel')}
          </button>
          <button className='Save_Button' onClick={handleSave} disabled={loading || !canSave}>
            {t('trekModal.connect')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Trek_Account_Modal;
