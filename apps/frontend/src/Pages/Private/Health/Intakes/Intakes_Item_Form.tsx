import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import type { IntakeItem, IntakeItemPayload, IntakeKind } from '../../../../Hooks/Health/intakesTypes';
import Intakes_Values_Fields from './Intakes_Values_Fields';
import { INTAKE_KINDS } from './intakesFormat';
import { parseValues, valuesForm, type IntakeValuesForm } from './intakesForm';

interface Intakes_Item_Form_Props {
  item: IntakeItem | null;
  saving: boolean;
  onSave: (payload: IntakeItemPayload, id?: string) => Promise<string | null>;
  onCancel: () => void;
}

const Intakes_Item_Form = ({ item, saving, onSave, onCancel }: Intakes_Item_Form_Props) => {
  const { t } = useTranslation('health');
  const idPrefix = `intake-item-${item?.id ?? 'new'}`;
  const [kind, setKind] = useState<IntakeKind>(item?.kind ?? 'CAFFEINE');
  const [name, setName] = useState(item?.name ?? '');
  const [values, setValues] = useState<IntakeValuesForm>(valuesForm(item));
  const [error, setError] = useState('');

  const parsed = parseValues(kind, values);
  const canSave = !saving && name.trim().length > 0 && parsed.valid;

  const handleValue = (field: keyof IntakeValuesForm, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const handleSave = async () => {
    if (!canSave) return;
    const failure = await onSave({ kind, name: name.trim(), ...parsed.values }, item?.id);
    if (failure) {
      setError(failure);
      return;
    }
    onCancel();
  };

  return (
    <div className='Intakes_Entry_Form'>
      <div className='Diary_Kinds'>
        {INTAKE_KINDS.map((option) => (
          <button key={option} type='button' className={option === kind ? 'active' : ''} onClick={() => setKind(option)}>
            {t(`intakes.kinds.${option}`)}
          </button>
        ))}
      </div>

      <div className='Health_Form intakes-form'>
        <div className='Health_Form_Field wide'>
          <label htmlFor={`${idPrefix}-name`}>{t('intakes.fields.name')}</label>
          <Global_Input
            id={`${idPrefix}-name`}
            value={name}
            maxLength={80}
            placeholder={t('intakes.fields.namePlaceholder')}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
          />
        </div>
        <Intakes_Values_Fields idPrefix={idPrefix} kind={kind} form={values} onChange={handleValue} />
      </div>

      <span className='Intakes_Preview'>{t('intakes.items.doseHint')}</span>
      {!parsed.valid && <p className='Health_Form_Error'>{t('intakes.form.valuesInvalid')}</p>}
      {error && <p className='Health_Form_Error'>{error}</p>}

      <div className='Diary_Actions'>
        <button type='button' className='Health_see_all' onClick={onCancel}>
          {t('common:actions.cancel')}
        </button>
        <button type='button' className='Health_Form_Save' disabled={!canSave} onClick={() => void handleSave()}>
          {saving ? t('intakes.saving') : t('intakes.save')}
        </button>
      </div>
    </div>
  );
};

export default Intakes_Item_Form;
