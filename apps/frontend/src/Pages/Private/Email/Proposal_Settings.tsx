import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import { FREQUENCY_OPTIONS } from '../../../Constants/runFrequency';
import type { ConnectedAccount, RunFrequency } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';

const OFF = 'OFF';

interface Proposal_Settings_Props {
  account: ConnectedAccount;
  onSave: (changes: { proposalFrequency?: RunFrequency | null; autoImplementProposalsAfterDays?: number | null }) => Promise<boolean>;
}

const Proposal_Settings = ({ account, onSave }: Proposal_Settings_Props) => {
  const { t } = useTranslation('email');
  const [days, setDays] = useState(account.autoImplementProposalsAfterDays?.toString() ?? '');

  const frequencyOptions = [
    { value: OFF, label: t('account.proposalsOff') },
    ...FREQUENCY_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
  ];

  const saveDays = async () => {
    const trimmed = days.trim();
    const parsed = trimmed === '' ? null : Math.round(Number(trimmed));
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 1 || parsed > 60)) {
      setDays(account.autoImplementProposalsAfterDays?.toString() ?? '');
      return;
    }
    if (parsed === account.autoImplementProposalsAfterDays) return;
    await onSave({ autoImplementProposalsAfterDays: parsed });
  };

  return (
    <div className='Apps_fields'>
      <div className='Apps_field'>
        <label>{t('account.proposalFrequency')}</label>
        <div className='Apps_frequency'>
          <Global_Dropdown
            value={account.proposalFrequency ?? OFF}
            options={frequencyOptions}
            onChange={(value) => onSave({ proposalFrequency: value === OFF ? null : (value as RunFrequency) })}
            searchable={false}
          />
        </div>
      </div>

      <div className='Apps_field'>
        <label htmlFor={`auto-implement-${account.id}`}>{t('account.autoImplement')}</label>
        <div className='Apps_frequency'>
          <Global_Input
            id={`auto-implement-${account.id}`}
            type='number'
            value={days}
            placeholder={t('account.autoImplementNever')}
            onChange={(e) => setDays(e.target.value)}
            onBlur={saveDays}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        </div>
      </div>

      <p className='Apps_section_note Gmail_hint'>{t('account.autoImplementHint')}</p>
    </div>
  );
};

export default Proposal_Settings;
