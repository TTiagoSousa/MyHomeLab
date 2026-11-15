import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import { useAiUsage, type UsageGroup } from '../../../Hooks/Settings/useAiUsage';
import { useAgentNames } from '../../../Hooks/Agent/useAgentNames';
import { dateLocale } from '../../../i18n';
import './Settings_Ai_Usage.scss';

const euros = (value: number) =>
  value.toLocaleString(dateLocale(), { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

const tokens = (value: number) =>
  value >= 1_000_000
    ? `${(value / 1_000_000).toLocaleString(dateLocale(), { maximumFractionDigits: 1 })}M`
    : `${Math.round(value / 1000).toLocaleString(dateLocale())}k`;

const Settings_Ai_Usage = () => {
  const { t } = useTranslation('settings');
  const { usage, saving, saveBudget } = useAiUsage();
  const { agents } = useAgentNames();
  const [budget, setBudget] = useState<string | null>(null);

  if (!usage) return null;
  const shownBudget = budget ?? (usage.budget !== null ? String(usage.budget) : '');
  const percent = usage.budget ? Math.min(100, Math.round((usage.total / usage.budget) * 100)) : null;
  const agentName = (key: string) => agents.find((agent) => agent.key === key)?.name ?? key;
  const maxDay = Math.max(0.01, ...usage.byDay.map((day) => day.cost));

  const rows = (items: UsageGroup[], label: (key: string) => string) =>
    items.map((item) => (
      <div key={item.key} className='Ai_Usage_Row'>
        <span>{label(item.key)}</span>
        <span className='Ai_Usage_Tokens'>
          {tokens(item.tokensIn + item.cacheRead)} → {tokens(item.tokensOut)}
        </span>
        <strong>{euros(item.cost)}</strong>
      </div>
    ));

  return (
    <div className='Ai_Usage'>
      <div className='Ai_Usage_Head'>
        <div>
          <div className='Settings_section_title'>{t('usage.title')}</div>
          <p className='Settings_section_description'>{t('usage.description')}</p>
        </div>
        <div className='Ai_Usage_Total'>
          <strong>{euros(usage.total)}</strong>
          <span>{usage.budget ? t('usage.ofBudget', { budget: euros(usage.budget), percent }) : t('usage.noBudget')}</span>
        </div>
      </div>

      {percent !== null && (
        <div className={`Ai_Usage_Bar${percent >= 100 ? ' over' : percent >= 80 ? ' warn' : ''}`}>
          <span style={{ width: `${percent}%` }} />
        </div>
      )}

      {usage.byDay.length > 0 && (
        <div className='Ai_Usage_Days' aria-label={t('usage.days')}>
          {usage.byDay.map((day) => (
            <span key={day.key} title={`${day.key}: ${euros(day.cost)}`} style={{ height: `${Math.max(4, (day.cost / maxDay) * 60)}px` }} />
          ))}
        </div>
      )}

      <div className='Ai_Usage_Columns'>
        <div>
          <span className='Ai_Usage_Label'>{t('usage.byAgent')}</span>
          {usage.byAgent.length ? rows(usage.byAgent, agentName) : <p className='Settings_card_detail'>{t('usage.empty')}</p>}
        </div>
        <div>
          <span className='Ai_Usage_Label'>{t('usage.bySource')}</span>
          {usage.bySource.length ? rows(usage.bySource, (key) => t(`usage.sources.${key}`, { defaultValue: key })) : <p className='Settings_card_detail'>{t('usage.empty')}</p>}
        </div>
      </div>

      <div className='Ai_Usage_Budget'>
        <label htmlFor='ai-budget'>{t('usage.budget')}</label>
        <Global_Input id='ai-budget' type='number' min='0' value={shownBudget} placeholder={t('usage.budgetPlaceholder')} onChange={(e) => setBudget(e.target.value)} />
        <button
          type='button'
          disabled={saving || budget === null}
          onClick={async () => {
            await saveBudget(shownBudget.trim() ? Number(shownBudget) : null);
            setBudget(null);
          }}
        >
          {t('usage.save')}
        </button>
        <span className='Settings_card_detail'>{t('usage.budgetHint')}</span>
      </div>
    </div>
  );
};

export default Settings_Ai_Usage;
