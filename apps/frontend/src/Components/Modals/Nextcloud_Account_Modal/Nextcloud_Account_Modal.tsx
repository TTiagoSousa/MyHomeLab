import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Nextcloud_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../App_Location_Fields/App_Location_Fields';

interface Nextcloud_Account_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
}

const Nextcloud_Account_Modal = ({ onClose, onSaved }: Nextcloud_Account_Modal_Props) => {
  const [displayName, setDisplayName] = useState('');
  const [serverId, setServerId] = useState('');
  const [vmid, setVmid] = useState('');
  const [caldavUrl, setCaldavUrl] = useState('');
  const [caldavUsername, setCaldavUsername] = useState('');
  const [caldavPassword, setCaldavPassword] = useState('');
  const { createNextcloudAccount, loading } = useConnectedAccount();
  const { t } = useTranslation('addons');

  const canSave = caldavUrl.trim().length > 0 && caldavUsername.trim().length > 0 && caldavPassword.length > 0;

  const handleSave = async () => {
    if (!canSave) return;

    const success = await createNextcloudAccount({
      serverConnectionId: serverId || undefined,
      guestVmid: serverId && vmid ? Number(vmid) : undefined,
      displayName: displayName.trim() || undefined,
      caldavUrl: caldavUrl.trim(),
      caldavUsername: caldavUsername.trim(),
      caldavPassword,
    });
    if (success) onSaved();
  };

  return (
    <div className="Nextcloud_Account_Modal_Overlay" onClick={onClose}>
      <div className="Nextcloud_Account_Modal" onClick={(e) => e.stopPropagation()}>
        <span className="Nextcloud_Account_Modal_Title">{t('nextcloudModal.title')}</span>

        <div className="Nextcloud_Account_Modal_Field">
          <label>{t('nextcloudModal.name')}</label>
          <Global_Input
            id="nextcloud-account-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('nextcloudModal.namePlaceholder')}
          />
        </div>

        <div className="Nextcloud_Account_Modal_Field">
          <label>{t('nextcloudModal.url')}</label>
          <Global_Input
            id="nextcloud-account-url"
            value={caldavUrl}
            onChange={(e) => setCaldavUrl(e.target.value)}
            placeholder={t('nextcloudModal.urlPlaceholder')}
          />
        </div>

        <div className="Nextcloud_Account_Modal_Field">
          <label>{t('nextcloudModal.username')}</label>
          <Global_Input
            id="nextcloud-account-username"
            value={caldavUsername}
            onChange={(e) => setCaldavUsername(e.target.value)}
            placeholder={t('nextcloudModal.usernamePlaceholder')}
          />
        </div>

        <div className="Nextcloud_Account_Modal_Field">
          <label>{t('nextcloudModal.password')}</label>
          <Global_Input
            id="nextcloud-account-password"
            type="password"
            value={caldavPassword}
            onChange={(e) => setCaldavPassword(e.target.value)}
            placeholder={t('nextcloudModal.passwordPlaceholder')}
          />
          <span className="Nextcloud_Account_Modal_Hint">{t('nextcloudModal.passwordHint')}</span>
        </div>

        <div className="Nextcloud_Account_Modal_Location">
          <App_Location_Fields
            serverId={serverId}
            vmid={vmid}
            onChange={(nextServerId, nextVmid) => {
              setServerId(nextServerId);
              setVmid(nextVmid);
            }}
            className="Nextcloud_Account_Modal_Location_Fields"
            fieldClassName="Nextcloud_Account_Modal_Field"
            errorClassName="Nextcloud_Account_Modal_Hint error"
          />
          <span className="Nextcloud_Account_Modal_Hint">{t('apps.account.location.connectHint')}</span>
        </div>

        <div className="Nextcloud_Account_Modal_Actions">
          <button className="Cancel_Button" onClick={onClose} disabled={loading}>
            {t('common:actions.cancel')}
          </button>
          <button className="Save_Button" onClick={handleSave} disabled={loading || !canSave}>
            {t('nextcloudModal.connect')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Nextcloud_Account_Modal;
