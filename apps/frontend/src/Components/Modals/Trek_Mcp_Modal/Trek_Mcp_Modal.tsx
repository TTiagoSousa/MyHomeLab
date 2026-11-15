import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Forgejo_Account_Modal/Forgejo_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useTrekMcpClient } from '../../../Hooks/ConnectedAccount/useTrekMcp';

interface Trek_Mcp_Modal_Props {
  accountId: string;
  configured: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const Trek_Mcp_Modal = ({ accountId, configured, onClose, onSaved }: Trek_Mcp_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const { saving, saveClient } = useTrekMcpClient();

  const canSave = clientId.trim().length > 0 && clientSecret.trim().length > 0;

  const save = async (id: string, secret: string) => {
    if (await saveClient(accountId, id, secret)) onSaved();
  };

  return (
    <div className='Forgejo_Account_Modal_Overlay' onClick={onClose}>
      <div className='Forgejo_Account_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Forgejo_Account_Modal_Title'>{t('apps.trek.mcp.title')}</span>
        <span className='Forgejo_Account_Modal_Hint'>{t('apps.trek.mcp.hint')}</span>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('apps.trek.mcp.clientId')}</label>
          <Global_Input id='trek-mcp-client-id' value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder='client_id' />
        </div>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('apps.trek.mcp.clientSecret')}</label>
          <Global_Input id='trek-mcp-client-secret' type='password' value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder='trekcs_…' />
          <span className='Forgejo_Account_Modal_Hint'>{t('apps.trek.mcp.secretHint')}</span>
        </div>

        <div className='Forgejo_Account_Modal_Actions'>
          {configured && (
            <button className='Cancel_Button' onClick={() => void save('', '')} disabled={saving}>
              {t('apps.trek.mcp.remove')}
            </button>
          )}
          <button className='Cancel_Button' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </button>
          <button className='Save_Button' onClick={() => void save(clientId.trim(), clientSecret.trim())} disabled={saving || !canSave}>
            {t('apps.trek.mcp.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Trek_Mcp_Modal;
