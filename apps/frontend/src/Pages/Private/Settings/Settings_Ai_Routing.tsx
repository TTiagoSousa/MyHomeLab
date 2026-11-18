import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { AI_WORKS, type AiRouting, type AiRoutingChange, type AiRoutes } from '../../../Hooks/Ai/useAiRouting';
import { CLAUDE_API, CLAUDE_CODE } from '../../../Constants/aiProviders';
import './Settings_Ai_Routing.scss';

interface Settings_Ai_Routing_Props {
  routing: AiRouting;
  saving: boolean;
  onSave: (change: AiRoutingChange) => Promise<boolean>;
}

const RUN_LIMITS = ['1', '2', '3', '4', '5', '6'];

const Settings_Ai_Routing = ({ routing, saving, onSave }: Settings_Ai_Routing_Props) => {
  const { t } = useTranslation('settings');
  const [routes, setRoutes] = useState<AiRoutes>(routing.routes);
  const [maxRuns, setMaxRuns] = useState(String(routing.maxClaudeCodeRuns));

  const providerOptions = [
    { value: 'claude-code', label: CLAUDE_CODE.name },
    { value: 'claude-api', label: CLAUDE_API.name },
  ];
  const changed =
    AI_WORKS.some((work) => routes[work] !== routing.routes[work]) || maxRuns !== String(routing.maxClaudeCodeRuns);

  return (
    <div className='Ai_Routing'>
      <div className='Ai_Routing_Head'>
        <div>
          <div className='Settings_section_title'>
            {t('routing.title')}
            {routing.mixed && <span className='Settings_card_tag on'>{t('ai.inUse')}</span>}
          </div>
          <p className='Settings_section_description'>{t('routing.description')}</p>
        </div>
        <div className='Settings_card_actions'>
          <button
            type='button'
            className={routing.mixed ? '' : 'primary'}
            onClick={() => void onSave({ mixed: !routing.mixed })}
            disabled={saving || (!routing.available && !routing.mixed)}
          >
            {routing.mixed ? t('routing.turnOff') : t('routing.turnOn')}
          </button>
        </div>
      </div>

      {!routing.available && <p className='Settings_card_detail'>{t('routing.needsKey')}</p>}

      <div className={`Ai_Routing_Table${routing.mixed ? '' : ' off'}`}>
        {AI_WORKS.map((work) => (
          <div key={work} className='Ai_Routing_Row'>
            <div className='Ai_Routing_Work'>
              <span>{t(`routing.works.${work}.name`)}</span>
              <span className='Settings_card_detail'>{t(`routing.works.${work}.hint`)}</span>
            </div>
            <Global_Dropdown
              id={`ai-route-${work}`}
              value={routes[work]}
              onChange={(value) => setRoutes({ ...routes, [work]: value as AiRoutes[typeof work] })}
              options={providerOptions}
              disabled={!routing.mixed || saving}
            />
          </div>
        ))}
      </div>

      <div className='Ai_Routing_Row'>
        <div className='Ai_Routing_Work'>
          <span>{t('routing.maxRuns')}</span>
          <span className='Settings_card_detail'>
            {t('routing.maxRunsHint')} {t('routing.now', routing.claudeCode)}
          </span>
        </div>
        <Global_Dropdown
          id='ai-max-runs'
          value={maxRuns}
          onChange={setMaxRuns}
          options={RUN_LIMITS.map((value) => ({ value, label: value }))}
          disabled={saving}
        />
      </div>

      <div className='Settings_card_actions Ai_Routing_Actions'>
        <button
          type='button'
          onClick={() => {
            setRoutes(routing.defaultRoutes);
          }}
          disabled={saving || !routing.mixed}
        >
          {t('routing.defaults')}
        </button>
        <button type='button' className='primary' onClick={() => void onSave({ routes, maxClaudeCodeRuns: Number(maxRuns) })} disabled={saving || !changed}>
          {t('routing.save')}
        </button>
      </div>
    </div>
  );
};

export default Settings_Ai_Routing;
