import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_TABS, TAB_GROUPS, tabLabelKey, type AverageTab } from './averageTabs';

interface Health_Tabs_Filter_Props {
  current: AverageTab[];
  saving: boolean;
  onClose: () => void;
  onSave: (tabs: AverageTab[]) => Promise<string | null>;
}

const Health_Tabs_Filter = ({ current, saving, onClose, onSave }: Health_Tabs_Filter_Props) => {
  const { t } = useTranslation('health');
  const [chosen, setChosen] = useState<Set<AverageTab>>(new Set(current));
  const [error, setError] = useState('');

  const toggle = (tab: AverageTab) => {
    const next = new Set(chosen);
    if (next.has(tab)) next.delete(tab);
    else next.add(tab);
    setChosen(next);
    setError('');
  };

  const save = async (tabs: AverageTab[]) => setError((await onSave(tabs)) ?? '');

  return (
    <div className='Health_Tabs_Filter' role='dialog' aria-label={t('averages.tabsFilter')}>
      <p className='Health_Tabs_Filter_Hint'>{t('averages.tabsFilterHint')}</p>

      {TAB_GROUPS.map((group) => (
        <fieldset key={group.key} className='Health_Tabs_Filter_Group'>
          <legend>{t(`averages.tabGroups.${group.key}`)}</legend>
          {group.tabs.map((tab) => (
            <label key={tab} className='Health_Tabs_Filter_Check'>
              <input type='checkbox' checked={chosen.has(tab)} onChange={() => toggle(tab)} />
              {t(tabLabelKey(tab))}
            </label>
          ))}
        </fieldset>
      ))}

      {error && <p className='Health_Tabs_Filter_Error'>{error}</p>}

      <div className='Health_Tabs_Filter_Actions'>
        <button type='button' className='Health_Tabs_Filter_Ghost' disabled={saving} onClick={() => void save([])}>
          {t('averages.tabsReset')}
        </button>
        <span />
        <button type='button' className='Health_Tabs_Filter_Ghost' disabled={saving} onClick={onClose}>
          {t('common:actions.cancel')}
        </button>
        <button
          type='button'
          className='Health_Tabs_Filter_Save'
          disabled={saving || !chosen.size}
          onClick={() => void save(ALL_TABS.filter((tab) => chosen.has(tab)))}
        >
          {saving ? t('body.saving') : t('body.save')}
        </button>
      </div>
    </div>
  );
};

export default Health_Tabs_Filter;
