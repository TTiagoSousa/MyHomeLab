import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Forgejo_Account_Modal/Forgejo_Account_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useOpenGymMcp } from '../../../Hooks/ConnectedAccount/useOpenGymMcp';

interface OpenGym_Mcp_Modal_Props {
  accountId: string;
  configured: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const OpenGym_Mcp_Modal = ({ accountId, configured, onClose, onSaved }: OpenGym_Mcp_Modal_Props) => {
  const { t } = useTranslation('addons');
  const [token, setToken] = useState('');
  const { saving, saveToken } = useOpenGymMcp();

  const save = async (value: string) => {
    if (await saveToken(accountId, value)) onSaved();
  };

  return (
    <div className='Forgejo_Account_Modal_Overlay' onClick={onClose}>
      <div className='Forgejo_Account_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Forgejo_Account_Modal_Title'>{t('apps.openGym.mcp.title')}</span>
        <span className='Forgejo_Account_Modal_Hint'>{t('apps.openGym.mcp.hint')}</span>

        <div className='Forgejo_Account_Modal_Field'>
          <label>{t('apps.openGym.mcp.token')}</label>
          <Global_Input id='opengym-mcp-token' type='password' value={token} onChange={(e) => setToken(e.target.value)} placeholder='ogt_…' />
          <span className='Forgejo_Account_Modal_Hint'>{t('apps.openGym.mcp.tokenHint')}</span>
        </div>

        <div className='Forgejo_Account_Modal_Actions'>
          {configured && (
            <button className='Cancel_Button' onClick={() => void save('')} disabled={saving}>
              {t('apps.openGym.mcp.remove')}
            </button>
          )}
          <button className='Cancel_Button' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </button>
          <button className='Save_Button' onClick={() => void save(token.trim())} disabled={saving || !token.trim()}>
            {t('apps.openGym.mcp.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OpenGym_Mcp_Modal;
