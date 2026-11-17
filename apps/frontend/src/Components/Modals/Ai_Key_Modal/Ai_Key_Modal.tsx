import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Ai_Key_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import type { AiProviderInfo } from '../../../Constants/aiProviders';

interface Ai_Key_Modal_Props {
  provider: AiProviderInfo;
  replacing: boolean;
  saving: boolean;
  onSave: (apiKey: string) => Promise<string | null>;
  onClose: () => void;
}

const Ai_Key_Modal = ({ provider, replacing, saving, onSave, onClose }: Ai_Key_Modal_Props) => {
  const { t } = useTranslation('settings');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  const canSave = apiKey.trim().length >= 10 && !saving;
  const texts = provider.slug === 'claude-api' ? 'ai.api.modal' : 'ai.modal';

  const handleSave = async () => {
    if (!canSave) return;
    setError('');
    const failure = await onSave(apiKey.trim());
    if (failure) setError(failure);
    else onClose();
  };

  return (
    <div className='Ai_Key_Modal_Overlay' onClick={() => !saving && onClose()}>
      <div className='Ai_Key_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Ai_Key_Modal_Head'>
          <span className='Ai_Key_Modal_Mark'>{provider.name.charAt(0)}</span>
          <div>
            <span className='Ai_Key_Modal_Title'>
              {t(replacing ? `${texts}.replaceTitle` : `${texts}.title`, { name: provider.name })}
            </span>
            <span className='Ai_Key_Modal_Vendor'>{provider.vendor}</span>
          </div>
        </div>

        <p className='Ai_Key_Modal_Text'>
          {t(`${texts}.where`)} <code>{provider.slug === 'claude-api' ? 'console.anthropic.com' : 'claude setup-token'}</code>
        </p>

        <div className='Ai_Key_Modal_Field'>
          <label htmlFor='ai-key-input'>{t(`${texts}.label`)}</label>
          <Global_Input
            id='ai-key-input'
            type='password'
            autoComplete='off'
            value={apiKey}
            placeholder={provider.keyPrefix ? `${provider.keyPrefix}…` : ''}
            onChange={(e) => {
              setApiKey(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSave();
            }}
          />
          <span className='Ai_Key_Modal_Hint'>{t('ai.modal.privacy')}</span>
        </div>

        {error && <p className='Ai_Key_Modal_Error'>{error}</p>}

        <div className='Ai_Key_Modal_Actions'>
          <button type='button' className='Cancel_Button' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </button>
          <button type='button' className='Save_Button' onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? t('ai.modal.verifying') : t('ai.modal.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Ai_Key_Modal;
