import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { FAST_TARGETS } from './fastingFormat';

interface Fasting_Target_Picker_Props {
  target: number;
  custom: string;
  onTarget: (hours: number) => void;
  onCustom: (value: string) => void;
}

const Fasting_Target_Picker = ({ target, custom, onTarget, onCustom }: Fasting_Target_Picker_Props) => {
  const { t } = useTranslation('health');

  return (
    <div className='Health_Form_Field'>
      <label>{t('fasting.form.target')}</label>
      <div className='Diary_Kinds'>
        {FAST_TARGETS.map((hours) => (
          <button
            key={hours}
            type='button'
            className={!custom.trim() && hours === target ? 'active' : ''}
            onClick={() => {
              onTarget(hours);
              onCustom('');
            }}
          >
            {t('fasting.hours', { value: hours })}
          </button>
        ))}
        <div className='Fasting_Custom'>
          <Global_Input
            type='number'
            min='1'
            max='168'
            value={custom}
            placeholder={t('fasting.form.custom')}
            onChange={(e) => onCustom(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default Fasting_Target_Picker;
