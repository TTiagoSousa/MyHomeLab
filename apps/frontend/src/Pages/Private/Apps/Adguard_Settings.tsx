import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdguardStatus } from '../../../Hooks/ConnectedAccount/useAdguardStatus';
import { useAdguardSettings } from '../../../Hooks/ConnectedAccount/useAdguardSettings';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { Apps_Section } from './appsShared';
import * as Icon from '../../../Imports/icons';
import { dateLocale } from '../../../i18n';

const FILTER_INTERVALS = [0, 1, 12, 24, 72, 168];

interface Adguard_Settings_Props {
  accountId: string;
  status: AdguardStatus;
  onChanged: () => void;
}

const Adguard_Settings = ({ accountId, status, onChanged }: Adguard_Settings_Props) => {
  const { t } = useTranslation('addons');
  const { saving, refreshing, saveSettings, refreshFilters } = useAdguardSettings();
  const [filtersInterval, setFiltersInterval] = useState(String(status.filtersInterval));

  const changed = filtersInterval !== String(status.filtersInterval);
  const options = FILTER_INTERVALS.map((hours) => ({ value: String(hours), label: t(`apps.adguard.settings.intervals.${hours}`) }));

  const save = async () => {
    if (await saveSettings(accountId, Number(filtersInterval))) onChanged();
  };

  const refresh = async () => {
    if (await refreshFilters(accountId)) onChanged();
  };

  return (
    <Apps_Section icon={<Icon.Settings />} title={t('apps.adguard.settings.title')} description={t('apps.adguard.settings.description')}>
      <div className='Apps_inline_fields'>
        <div className='Apps_inline_field'>
          <label>{t('apps.adguard.settings.interval')}</label>
          <Global_Dropdown value={filtersInterval} options={options} onChange={setFiltersInterval} searchable={false} />
        </div>
      </div>
      <p className='Apps_section_note'>
        {status.filtersUpdatedAt
          ? t('apps.adguard.settings.lastUpdate', { date: new Date(status.filtersUpdatedAt).toLocaleString(dateLocale()) })
          : t('apps.adguard.settings.neverUpdated')}{' '}
        {t('apps.adguard.filtersValue', { enabled: status.enabledFilters, total: status.filters, rules: status.rules })}
      </p>
      <div className='Apps_location_actions'>
        <button type='button' onClick={() => void refresh()} disabled={refreshing || saving}>
          {refreshing ? t('apps.adguard.settings.refreshing') : t('apps.adguard.settings.refresh')}
        </button>
        {changed && (
          <>
            <button type='button' onClick={() => setFiltersInterval(String(status.filtersInterval))} disabled={saving}>
              {t('apps.cancel')}
            </button>
            <button type='button' className='active' onClick={() => void save()} disabled={saving}>
              {saving ? t('apps.adguard.settings.saving') : t('apps.adguard.settings.save')}
            </button>
          </>
        )}
      </div>
    </Apps_Section>
  );
};

export default Adguard_Settings;
