import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../Inputs/Global_Input/Global_Input';
import type { HealthForm, HealthFormField } from '../../Hooks/Health/healthTypes';
import type { HealthFormDraft } from '../../Hooks/Health/useHealthForms';
import { FORM_FIELD_GROUPS } from '../../Pages/Private/Health/Metrics/metricCatalog';

interface Health_Form_Editor_Props {
  existing: HealthForm | null;
  saving: boolean;
  onSave: (draft: HealthFormDraft) => Promise<string | null>;
  onCancel: () => void;
}

const Health_Form_Editor = ({ existing, saving, onSave, onCancel }: Health_Form_Editor_Props) => {
  const { t } = useTranslation('health');
  const [name, setName] = useState(existing?.name ?? '');
  const [fields, setFields] = useState<Set<HealthFormField>>(new Set(existing?.fields ?? []));
  const [error, setError] = useState('');

  const toggle = (field: HealthFormField) => {
    const next = new Set(fields);
    if (next.has(field)) next.delete(field);
    else next.add(field);
    setFields(next);
    setError('');
  };

  const handleSave = async () => {
    if (!name.trim() || !fields.size || saving) return;
    const failure = await onSave({ name: name.trim(), fields: [...fields] });
    if (failure) setError(failure);
  };

  return (
    <div className='Health_Forms_Editor'>
      <div className='Health_Forms_Field'>
        <label htmlFor='health-form-name'>{t('forms.name')}</label>
        <Global_Input
          id='health-form-name'
          value={name}
          maxLength={40}
          placeholder={t('forms.namePlaceholder')}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
        />
      </div>

      {FORM_FIELD_GROUPS.map((group) => (
        <fieldset key={group.key} className='Health_Forms_Group'>
          <legend>{t(`forms.groups.${group.key}`)}</legend>
          {group.fields.map((field) => (
            <label key={field} className='Health_Forms_Check'>
              <input type='checkbox' checked={fields.has(field)} onChange={() => toggle(field)} />
              {t(`bodyMetrics.names.${field}`)}
            </label>
          ))}
        </fieldset>
      ))}

      {error && <p className='Health_Forms_Error'>{error}</p>}

      <div className='Health_Forms_Actions'>
        <button type='button' className='Health_Forms_Ghost' onClick={onCancel} disabled={saving}>
          {t('common:actions.cancel')}
        </button>
        <button type='button' className='Health_Forms_Solid' onClick={() => void handleSave()} disabled={saving || !name.trim() || !fields.size}>
          {saving ? t('body.saving') : t('forms.saveForm')}
        </button>
      </div>
    </div>
  );
};

export default Health_Form_Editor;
