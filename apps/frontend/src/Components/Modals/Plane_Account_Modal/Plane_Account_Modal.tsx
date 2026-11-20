import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Forgejo_Account_Modal/Forgejo_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../App_Location_Fields/App_Location_Fields';

interface Plane_Account_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
  initialUrl?: string;
  initialWorkspace?: string;
}

const Plane_Account_Modal = ({ onClose, onSaved, initialUrl = '', initialWorkspace = '' }: Plane_Account_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [displayName, setDisplayName] = useState('');
  const [serverId, setServerId] = useState('');
  const [vmid, setVmid] = useState('');
  const [baseUrl, setBaseUrl] = useState(initialUrl);
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [apiKey, setApiKey] = useState('');
  const { createPlaneAccount, loading } = useConnectedAccount();

  const canSave = baseUrl.trim().length > 0 && workspace.trim().length > 0 && apiKey.trim().length >= 10;

  const handleSave = async () => {
    if (!canSave) return;
    const success = await createPlaneAccount({
      serverConnectionId: serverId || undefined,
      guestVmid: serverId && vmid ? Number(vmid) : undefined,
      displayName: displayName.trim() || undefined,
      baseUrl: baseUrl.trim(),
      workspace: workspace.trim(),
      apiKey: apiKey.trim(),
    });
    if (success) onSaved();
  };

  return (
    <div className='Forgejo_Account_Modal_Overlay' onClick={onClose}>
      <div className='Forgejo_Account_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Forgejo_Account_Modal_Title'>{t('planeModal.title')}</span>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('planeModal.name')}</label>
          <Global_Input id='plane-account-name' value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('planeModal.namePlaceholder')} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('planeModal.url')}</label>
          <Global_Input id='plane-account-url' value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={t('planeModal.urlPlaceholder')} />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('planeModal.workspace')}</label>
          <Global_Input id='plane-account-workspace' value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder={t('planeModal.workspacePlaceholder')} />
          <span className='Forgejo_Account_Modal_Hint'>{t('planeModal.workspaceHint')}</span>
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('planeModal.apiKey')}</label>
          <Global_Input id='plane-account-key' type='password' value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          <span className='Forgejo_Account_Modal_Hint'>{t('planeModal.apiKeyHint')}</span>
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
            {t('planeModal.connect')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Plane_Account_Modal;
