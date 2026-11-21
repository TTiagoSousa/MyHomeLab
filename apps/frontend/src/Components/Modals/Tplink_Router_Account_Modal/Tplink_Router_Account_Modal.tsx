import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Forgejo_Account_Modal/Forgejo_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../App_Location_Fields/App_Location_Fields';

interface Tplink_Router_Account_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
}

const Tplink_Router_Account_Modal = ({ onClose, onSaved }: Tplink_Router_Account_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [displayName, setDisplayName] = useState('');
  const [serverId, setServerId] = useState('');
  const [vmid, setVmid] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const { createTplinkRouterAccount, loading } = useConnectedAccount();

  const canSave = baseUrl.trim().length > 0 && password.length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    const success = await createTplinkRouterAccount({
      serverConnectionId: serverId || undefined,
      guestVmid: serverId && vmid ? Number(vmid) : undefined,
      displayName: displayName.trim() || undefined,
      baseUrl: baseUrl.trim(),
      username: username.trim() || undefined,
      password,
    });
    if (success) onSaved();
  };

  return (
    <div className='Forgejo_Account_Modal_Overlay' onClick={onClose}>
      <div className='Forgejo_Account_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Forgejo_Account_Modal_Title'>{t('tplinkRouterModal.title')}</span>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('tplinkRouterModal.name')}</label>
          <Global_Input
            id='tplink-router-account-name'
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('tplinkRouterModal.namePlaceholder')}
          />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('tplinkRouterModal.url')}</label>
          <Global_Input
            id='tplink-router-account-url'
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={t('tplinkRouterModal.urlPlaceholder')}
          />
          <span className='Forgejo_Account_Modal_Hint'>{t('tplinkRouterModal.urlHint')}</span>
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('tplinkRouterModal.username')}</label>
          <Global_Input id='tplink-router-account-username' value={username} onChange={(e) => setUsername(e.target.value)} autoComplete='off' />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('tplinkRouterModal.password')}</label>
          <Global_Input
            id='tplink-router-account-password'
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete='new-password'
          />
          <span className='Forgejo_Account_Modal_Hint'>{t('tplinkRouterModal.passwordHint')}</span>
          <span className='Forgejo_Account_Modal_Hint'>{t('tplinkRouterModal.sessionHint')}</span>
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
            {t('tplinkRouterModal.connect')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tplink_Router_Account_Modal;
