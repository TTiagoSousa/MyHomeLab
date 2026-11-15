import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import type { IntakeKind } from '../../../../Hooks/Health/intakesTypes';
import { alcoholFromAbv, formatNumber, parseDecimal } from './intakesFormat';
import type { IntakeValuesForm } from './intakesForm';

interface Intakes_Values_Fields_Props {
  idPrefix: string;
  kind: IntakeKind;
  form: IntakeValuesForm;
  onChange: (field: keyof IntakeValuesForm, value: string) => void;
}

const Intakes_Values_Fields = ({ idPrefix, kind, form, onChange }: Intakes_Values_Fields_Props) => {
  const { t } = useTranslation('health');
  const volume = parseDecimal(form.volumeMl);
  const abv = parseDecimal(form.abv);
  const computedAlcohol =
    volume != null && abv != null && !Number.isNaN(volume) && !Number.isNaN(abv) ? formatNumber(alcoholFromAbv(volume, abv)) : '';

  const numberInput = (field: keyof IntakeValuesForm, max: string, placeholder?: string) => (
    <div className='Health_Form_Field'>
      <label htmlFor={`${idPrefix}-${field}`}>{t(`intakes.fields.${field}`)}</label>
      <Global_Input
        id={`${idPrefix}-${field}`}
        type='number'
        min='0'
        max={max}
        value={form[field]}
        placeholder={placeholder}
        onChange={(e) => onChange(field, e.target.value)}
      />
    </div>
  );

  return (
    <>
      {numberInput('volumeMl', '10000')}
      {kind === 'CAFFEINE' && numberInput('caffeineMg', '5000')}
      {kind === 'ALCOHOL' && numberInput('abv', '100')}
      {kind === 'ALCOHOL' && numberInput('alcoholG', '1000', computedAlcohol)}
    </>
  );
};

export default Intakes_Values_Fields;
