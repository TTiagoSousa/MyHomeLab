import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Settings_Cards.scss';
import { useAiProviders } from '../../../Hooks/Ai/useAiProviders';
import { CLAUDE_CODE } from '../../../Constants/aiProviders';
import Ai_Key_Modal from '../../../Components/Modals/Ai_Key_Modal/Ai_Key_Modal';
import Settings_Ai_Models from './Settings_Ai_Models';
import { dateLocale } from '../../../i18n';
import Settings_Ai_Usage from './Settings_Ai_Usage';

const Settings_Ai = () => {
  const { t } = useTranslation('settings');
  const { providers, status, checking, saving, fetchStatus, saveKey, removeKey, saveModels } = useAiProviders();
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [choosingModels, setChoosingModels] = useState(false);

  useEffect(() => {
    void fetchStatus();
  }, []);

  const entry = providers[0];
  const state = !status ? 'unknown' : !status.installed ? 'missing' : status.loggedIn ? 'on' : 'off';

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

  const handleRemove = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setConfirmRemove(false);
    await removeKey();
  };

  return (
    <div className='Settings_section Settings_cards'>
      <div className='Settings_cards_head'>
        <div>
          <div className='Settings_section_title'>{t('ai.title')}</div>
          <p className='Settings_section_description'>{t('ai.description')}</p>
        </div>
      </div>

      {entry && (
        <div className='Settings_cards_list'>
          <div className='Settings_card'>
            <span className='Settings_card_mark'>C</span>

            <div className='Settings_card_text'>
              <span className='Settings_card_name'>
                {CLAUDE_CODE.name}
                <span className={`Settings_card_tag${state === 'on' ? ' on' : ''}`}>{t(`ai.state.${state}`)}</span>
              </span>
              {status?.installed && (
                <span className='Settings_card_detail'>
                  {t('ai.version', { version: status.version ?? '?' })}
                  {status.loggedIn && status.subscription ? ` · ${t('ai.subscription', { plan: status.subscription })}` : ''}
                  {status.loggedIn && status.expiresAt ? ` · ${t('ai.expires', { date: formatDate(status.expiresAt) })}` : ''}
                </span>
              )}
              <span className='Settings_card_key'>
                {entry.usesMachineLogin ? t('ai.machineLogin') : `${CLAUDE_CODE.keyPrefix}••••${entry.keyHint}`}
              </span>
              <span className='Settings_card_detail'>{t('ai.modelsSummary', { main: entry.models.main, agent: entry.models.agent })}</span>
              {state === 'missing' && <span className='Settings_card_detail error'>{t('ai.missingHint')}</span>}
              {state === 'off' && <span className='Settings_card_detail error'>{t('ai.loginHint')}</span>}
            </div>

            <div className='Settings_card_actions'>
              <button type='button' onClick={() => void fetchStatus()} disabled={checking}>
                {checking ? t('ai.checking') : t('ai.check')}
              </button>
              <button type='button' onClick={() => setChoosingModels(!choosingModels)}>
                {t('ai.models')}
              </button>
              <button type='button' onClick={() => setEditing(true)}>
                {entry.usesMachineLogin ? t('ai.useToken') : t('ai.replace')}
              </button>
              {!entry.usesMachineLogin && (
                <button type='button' className={`danger${confirmRemove ? ' confirm' : ''}`} onClick={() => void handleRemove()}>
                  {confirmRemove ? t('ai.confirmRemove') : t('ai.remove')}
                </button>
              )}
            </div>

            {choosingModels && <Settings_Ai_Models entry={entry} onSave={saveModels} onClose={() => setChoosingModels(false)} />}
          </div>
        </div>
      )}

      <Settings_Ai_Usage />

      {editing && (
        <Ai_Key_Modal provider={CLAUDE_CODE} replacing={!entry?.usesMachineLogin} saving={saving} onSave={saveKey} onClose={() => setEditing(false)} />
      )}
    </div>
  );
};

export default Settings_Ai;
