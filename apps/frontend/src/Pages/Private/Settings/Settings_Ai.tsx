import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Settings_Cards.scss';
import { useAiProviders, type AiProviderId } from '../../../Hooks/Ai/useAiProviders';
import { CLAUDE_API, CLAUDE_CODE } from '../../../Constants/aiProviders';
import Ai_Key_Modal from '../../../Components/Modals/Ai_Key_Modal/Ai_Key_Modal';
import Settings_Ai_Models from './Settings_Ai_Models';
import { dateLocale } from '../../../i18n';
import Settings_Ai_Usage from './Settings_Ai_Usage';

const INFO = { 'claude-code': CLAUDE_CODE, 'claude-api': CLAUDE_API };

const Settings_Ai = () => {
  const { t } = useTranslation('settings');
  const { providers, status, checking, saving, fetchStatus, saveKey, removeKey, saveModels, activate } = useAiProviders();
  const [editing, setEditing] = useState<AiProviderId | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<AiProviderId | null>(null);
  const [choosingModels, setChoosingModels] = useState<AiProviderId | null>(null);

  useEffect(() => {
    void fetchStatus();
  }, []);

  const code = providers.find((entry) => entry.provider === 'claude-code');
  const api = providers.find((entry) => entry.provider === 'claude-api');
  const editingEntry = providers.find((entry) => entry.provider === editing);
  const codeState = !status ? 'unknown' : !status.installed ? 'missing' : status.loggedIn ? 'on' : 'off';

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

  const handleRemove = async (provider: AiProviderId) => {
    if (confirmRemove !== provider) {
      setConfirmRemove(provider);
      return;
    }
    setConfirmRemove(null);
    await removeKey(provider);
  };

  const activateButton = (provider: AiProviderId, disabled = false) => (
    <button type='button' className='primary' onClick={() => void activate(provider, INFO[provider].name)} disabled={disabled}>
      {t('ai.use')}
    </button>
  );

  return (
    <div className='Settings_section Settings_cards'>
      <div className='Settings_cards_head'>
        <div>
          <div className='Settings_section_title'>{t('ai.title')}</div>
          <p className='Settings_section_description'>{t('ai.description')}</p>
        </div>
      </div>

      <div className='Settings_cards_list'>
        {code && (
          <div className={`Settings_card${code.isActive ? ' active' : ''}`}>
            <span className='Settings_card_mark'>C</span>

            <div className='Settings_card_text'>
              <span className='Settings_card_name'>
                {CLAUDE_CODE.name}
                <span className={`Settings_card_tag${codeState === 'on' ? ' on' : ''}`}>{t(`ai.state.${codeState}`)}</span>
                {code.isActive && <span className='Settings_card_tag on'>{t('ai.inUse')}</span>}
              </span>
              {status?.installed && (
                <span className='Settings_card_detail'>
                  {t('ai.version', { version: status.version ?? '?' })}
                  {status.loggedIn && status.subscription ? ` · ${t('ai.subscription', { plan: status.subscription })}` : ''}
                  {status.loggedIn && status.expiresAt ? ` · ${t('ai.expires', { date: formatDate(status.expiresAt) })}` : ''}
                </span>
              )}
              <span className='Settings_card_key'>
                {code.usesMachineLogin ? t('ai.machineLogin') : `${CLAUDE_CODE.keyPrefix}••••${code.keyHint}`}
              </span>
              <span className='Settings_card_detail'>{t('ai.modelsSummary', { main: code.models.main, agent: code.models.agent })}</span>
              {codeState === 'missing' && <span className='Settings_card_detail error'>{t('ai.missingHint')}</span>}
              {codeState === 'off' && <span className='Settings_card_detail error'>{t('ai.loginHint')}</span>}
            </div>

            <div className='Settings_card_actions'>
              {!code.isActive && activateButton('claude-code')}
              <button type='button' onClick={() => void fetchStatus()} disabled={checking}>
                {checking ? t('ai.checking') : t('ai.check')}
              </button>
              <button type='button' onClick={() => setChoosingModels(choosingModels === 'claude-code' ? null : 'claude-code')}>
                {t('ai.models')}
              </button>
              <button type='button' onClick={() => setEditing('claude-code')}>
                {code.usesMachineLogin ? t('ai.useToken') : t('ai.replace')}
              </button>
              {!code.usesMachineLogin && (
                <button
                  type='button'
                  className={`danger${confirmRemove === 'claude-code' ? ' confirm' : ''}`}
                  onClick={() => void handleRemove('claude-code')}
                >
                  {confirmRemove === 'claude-code' ? t('ai.confirmRemove') : t('ai.remove')}
                </button>
              )}
            </div>

            {choosingModels === 'claude-code' && (
              <Settings_Ai_Models entry={code} onSave={(models) => saveModels('claude-code', models)} onClose={() => setChoosingModels(null)} />
            )}
          </div>
        )}

        {api && (
          <div className={`Settings_card${api.isActive ? ' active' : ''}`}>
            <span className='Settings_card_mark'>A</span>

            <div className='Settings_card_text'>
              <span className='Settings_card_name'>
                {CLAUDE_API.name}
                <span className={`Settings_card_tag${api.configured ? ' on' : ''}`}>{t(api.configured ? 'ai.api.ready' : 'ai.api.noKey')}</span>
                {api.isActive && <span className='Settings_card_tag on'>{t('ai.inUse')}</span>}
              </span>
              <span className='Settings_card_detail'>{t('ai.api.cost')}</span>
              {api.configured && <span className='Settings_card_key'>{`${CLAUDE_API.keyPrefix}••••${api.keyHint}`}</span>}
              <span className='Settings_card_detail'>{t('ai.modelsSummary', { main: api.models.main, agent: api.models.agent })}</span>
            </div>

            <div className='Settings_card_actions'>
              {!api.isActive && api.configured && activateButton('claude-api')}
              <button type='button' onClick={() => setChoosingModels(choosingModels === 'claude-api' ? null : 'claude-api')}>
                {t('ai.models')}
              </button>
              <button type='button' onClick={() => setEditing('claude-api')}>
                {api.configured ? t('ai.api.replaceKey') : t('ai.api.addKey')}
              </button>
              {api.configured && (
                <button
                  type='button'
                  className={`danger${confirmRemove === 'claude-api' ? ' confirm' : ''}`}
                  onClick={() => void handleRemove('claude-api')}
                >
                  {confirmRemove === 'claude-api' ? t('ai.confirmRemove') : t('ai.api.removeKey')}
                </button>
              )}
            </div>

            {choosingModels === 'claude-api' && (
              <Settings_Ai_Models entry={api} onSave={(models) => saveModels('claude-api', models)} onClose={() => setChoosingModels(null)} />
            )}
          </div>
        )}
      </div>

      <Settings_Ai_Usage />

      {editing && editingEntry && (
        <Ai_Key_Modal
          provider={INFO[editing]}
          replacing={editing === 'claude-api' ? editingEntry.configured : !editingEntry.usesMachineLogin}
          saving={saving}
          onSave={(key) => saveKey(editing, key)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export default Settings_Ai;
