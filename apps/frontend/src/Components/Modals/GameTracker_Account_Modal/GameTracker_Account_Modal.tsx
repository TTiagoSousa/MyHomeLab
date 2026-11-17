import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Forgejo_Account_Modal/Forgejo_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../App_Location_Fields/App_Location_Fields';

interface GameTracker_Account_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
  initialUrl?: string;
}

const GameTracker_Account_Modal = ({ onClose, onSaved, initialUrl = '' }: GameTracker_Account_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [displayName, setDisplayName] = useState('');
  const [serverId, setServerId] = useState('');
  const [vmid, setVmid] = useState('');
  const [baseUrl, setBaseUrl] = useState(initialUrl);
  const [token, setToken] = useState('');
  const { createGameTrackerAccount, loading } = useConnectedAccount();

  const canSave = baseUrl.trim().length > 0 && token.trim().startsWith('gtv_');

  const handleSave = async () => {
    if (!canSave) return;
    const success = await createGameTrackerAccount({
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
        <span className='Forgejo_Account_Modal_Title'>{t('gameTrackerModal.title')}</span>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('gameTrackerModal.name')}</label>
          <Global_Input id='gametracker-account-name' value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('gameTrackerModal.namePlaceholder')} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('gameTrackerModal.url')}</label>
          <Global_Input id='gametracker-account-url' value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={t('gameTrackerModal.urlPlaceholder')} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('gameTrackerModal.token')}</label>
          <Global_Input id='gametracker-account-token' type='password' value={token} onChange={(e) => setToken(e.target.value)} placeholder='gtv_…' />
          <span className='Forgejo_Account_Modal_Hint'>{t('gameTrackerModal.tokenHint')}</span>
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
            {t('gameTrackerModal.connect')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameTracker_Account_Modal;
