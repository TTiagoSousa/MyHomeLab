import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Forgejo_Account_Modal/Forgejo_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../App_Location_Fields/App_Location_Fields';

interface ClickHouse_Account_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
  initialUrl?: string;
  initialUsername?: string;
}

const ClickHouse_Account_Modal = ({ onClose, onSaved, initialUrl = '', initialUsername = '' }: ClickHouse_Account_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [displayName, setDisplayName] = useState('');
  const [serverId, setServerId] = useState('');
  const [vmid, setVmid] = useState('');
  const [baseUrl, setBaseUrl] = useState(initialUrl);
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState('');
  const { createClickHouseAccount, loading } = useConnectedAccount();

  const canSave = baseUrl.trim().length > 0 && username.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    const success = await createClickHouseAccount({
      serverConnectionId: serverId || undefined,
      guestVmid: serverId && vmid ? Number(vmid) : undefined,
      displayName: displayName.trim() || undefined,
      baseUrl: baseUrl.trim(),
      username: username.trim(),
      password,
    });
    if (success) onSaved();
  };

  return (
    <div className='Forgejo_Account_Modal_Overlay' onClick={onClose}>
      <div className='Forgejo_Account_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Forgejo_Account_Modal_Title'>{t('clickhouseModal.title')}</span>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('clickhouseModal.name')}</label>
          <Global_Input id='clickhouse-account-name' value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('clickhouseModal.namePlaceholder')} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('clickhouseModal.url')}</label>
          <Global_Input id='clickhouse-account-url' value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={t('clickhouseModal.urlPlaceholder')} />
          <span className='Forgejo_Account_Modal_Hint'>{t('clickhouseModal.urlHint')}</span>
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('clickhouseModal.username')}</label>
          <Global_Input id='clickhouse-account-user' value={username} onChange={(e) => setUsername(e.target.value)} placeholder='default' autoComplete='off' />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('clickhouseModal.password')}</label>
          <Global_Input id='clickhouse-account-password' type='password' value={password} onChange={(e) => setPassword(e.target.value)} autoComplete='new-password' />
          <span className='Forgejo_Account_Modal_Hint'>{t('clickhouseModal.passwordHint')}</span>
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
            {t('clickhouseModal.connect')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClickHouse_Account_Modal;
