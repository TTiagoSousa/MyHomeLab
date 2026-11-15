import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import type { IntakeSettings, IntakeSettingsPayload } from '../../../../Hooks/Health/intakesTypes';
import { parseDecimal, roundTo } from './intakesFormat';

interface Intakes_Limits_Form_Props {
  settings: IntakeSettings;
  saving: boolean;
  onSave: (payload: IntakeSettingsPayload) => Promise<string | null>;
}

const Intakes_Limits_Form = ({ settings, saving, onSave }: Intakes_Limits_Form_Props) => {
  const { t } = useTranslation('health');
  const [caffeine, setCaffeine] = useState(String(settings.caffeineLimitMg));
  const [alcohol, setAlcohol] = useState(String(settings.alcoholLimitWeek));
  const [error, setError] = useState('');

  const caffeineValue = parseDecimal(caffeine);
  const alcoholValue = parseDecimal(alcohol);
  const validCaffeine = caffeineValue != null && Number.isInteger(caffeineValue) && caffeineValue >= 0 && caffeineValue <= 2000;
  const validAlcohol = alcoholValue != null && !Number.isNaN(alcoholValue) && alcoholValue >= 0 && alcoholValue <= 100;
  const changed = caffeineValue !== settings.caffeineLimitMg || alcoholValue !== settings.alcoholLimitWeek;
  const canSave = !saving && validCaffeine && validAlcohol && changed;

  const handleSave = async () => {
    if (!canSave || caffeineValue == null || alcoholValue == null) return;
    const failure = await onSave({ caffeineLimitMg: caffeineValue, alcoholLimitWeek: roundTo(alcoholValue, 1) });
    setError(failure ?? '');
  };

  return (
    <>
      <div className='Health_Form intakes-limits'>
        <div className='Health_Form_Field'>
          <label htmlFor='intakes-caffeine-limit'>{t('intakes.settings.caffeineLimit')}</label>
          <Global_Input
            id='intakes-caffeine-limit'
            type='number'
            min='0'
            max='2000'
            value={caffeine}
            onChange={(e) => setCaffeine(e.target.value)}
          />
        </div>
        <div className='Health_Form_Field'>
          <label htmlFor='intakes-alcohol-limit'>{t('intakes.settings.alcoholLimit')}</label>
          <Global_Input
            id='intakes-alcohol-limit'
            type='number'
            min='0'
            max='100'
            value={alcohol}
            onChange={(e) => setAlcohol(e.target.value)}
          />
        </div>
        <button type='button' className='Health_Form_Save' disabled={!canSave} onClick={() => void handleSave()}>
          {saving ? t('intakes.saving') : t('intakes.save')}
        </button>
      </div>
      {(!validCaffeine || !validAlcohol) && <p className='Health_Form_Error'>{t('intakes.settings.limitsInvalid')}</p>}
      {error && <p className='Health_Form_Error'>{error}</p>}
    </>
  );
};

export default Intakes_Limits_Form;
