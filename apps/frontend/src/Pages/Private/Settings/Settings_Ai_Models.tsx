import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { useAiModels } from '../../../Hooks/Ai/useAiModels';
import type { AiModels, AiProviderEntry } from '../../../Hooks/Ai/useAiProviders';

interface Settings_Ai_Models_Props {
  entry: AiProviderEntry;
  onSave: (models: AiModels) => Promise<boolean>;
  onClose: () => void;
}

const Settings_Ai_Models = ({ entry, onSave, onClose }: Settings_Ai_Models_Props) => {
  const { t } = useTranslation('settings');
  const { models, loading, error } = useAiModels(entry.provider);
  const [main, setMain] = useState(entry.models.main);
  const [agent, setAgent] = useState(entry.models.agent);
  const [saving, setSaving] = useState(false);

  const options = (current: string, fallback: string) =>
    [...new Set([fallback, current, ...models])].map((model) => ({
      value: model,
      label: model === fallback ? t('ai.defaultModel', { model }) : model,
    }));

  const save = async () => {
    setSaving(true);
    const saved = await onSave({ main, agent });
    setSaving(false);
    if (saved) onClose();
  };

  return (
    <div className='Settings_card_models'>
      <div className='Settings_card_models_field'>
        <label htmlFor={`ai-main-${entry.provider}`}>{t('ai.mainModel')}</label>
        <Global_Dropdown
          id={`ai-main-${entry.provider}`}
          value={main}
          onChange={setMain}
          options={options(main, entry.defaultModels.main)}
          searchable
          disabled={loading}
        />
        <span>{t('ai.mainModelHint')}</span>
      </div>
      <div className='Settings_card_models_field'>
        <label htmlFor={`ai-agent-${entry.provider}`}>{t('ai.agentModel')}</label>
        <Global_Dropdown
          id={`ai-agent-${entry.provider}`}
          value={agent}
          onChange={setAgent}
          options={options(agent, entry.defaultModels.agent)}
          searchable
          disabled={loading}
        />
        <span>{t('ai.agentModelHint')}</span>
      </div>
      {error && <p className='Settings_card_detail error'>{error}</p>}
      <div className='Settings_card_actions'>
        <button type='button' onClick={onClose} disabled={saving}>
          {t('common:actions.cancel')}
        </button>
        <button type='button' onClick={() => void save()} disabled={saving || loading}>
          {t('ai.saveModels')}
        </button>
      </div>
    </div>
  );
};

export default Settings_Ai_Models;
