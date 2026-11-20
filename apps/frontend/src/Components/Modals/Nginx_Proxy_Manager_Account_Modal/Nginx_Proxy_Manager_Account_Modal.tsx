import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Forgejo_Account_Modal/Forgejo_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../App_Location_Fields/App_Location_Fields';

interface Nginx_Proxy_Manager_Account_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
}

const Nginx_Proxy_Manager_Account_Modal = ({ onClose, onSaved }: Nginx_Proxy_Manager_Account_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [displayName, setDisplayName] = useState('');
  const [serverId, setServerId] = useState('');
  const [vmid, setVmid] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { createNginxProxyManagerAccount, loading } = useConnectedAccount();

  const canSave = baseUrl.trim().length > 0 && email.trim().includes('@') && password.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    const success = await createNginxProxyManagerAccount({
      serverConnectionId: serverId || undefined,
      guestVmid: serverId && vmid ? Number(vmid) : undefined,
      displayName: displayName.trim() || undefined,
      baseUrl: baseUrl.trim(),
      email: email.trim(),
      password,
    });
    if (success) onSaved();
  };

  return (
    <div className='Forgejo_Account_Modal_Overlay' onClick={onClose}>
      <div className='Forgejo_Account_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Forgejo_Account_Modal_Title'>{t('nginxProxyManagerModal.title')}</span>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('nginxProxyManagerModal.name')}</label>
          <Global_Input
            id='nginx-proxy-manager-account-name'
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('nginxProxyManagerModal.namePlaceholder')}
          />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('nginxProxyManagerModal.url')}</label>
          <Global_Input
            id='nginx-proxy-manager-account-url'
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={t('nginxProxyManagerModal.urlPlaceholder')}
          />
          <span className='Forgejo_Account_Modal_Hint'>{t('nginxProxyManagerModal.urlHint')}</span>
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('nginxProxyManagerModal.email')}</label>
          <Global_Input
            id='nginx-proxy-manager-account-email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('nginxProxyManagerModal.emailPlaceholder')}
          />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('nginxProxyManagerModal.password')}</label>
          <Global_Input id='nginx-proxy-manager-account-password' type='password' value={password} onChange={(e) => setPassword(e.target.value)} />
          <span className='Forgejo_Account_Modal_Hint'>{t('nginxProxyManagerModal.hint')}</span>
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
            {t('nginxProxyManagerModal.connect')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Nginx_Proxy_Manager_Account_Modal;
