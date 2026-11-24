import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../Inputs/Global_Input/Global_Input';
import type { HealthForm, HealthFormField, HealthFormLayout } from '../../Hooks/Health/healthTypes';
import type { HealthFormDraft } from '../../Hooks/Health/useHealthForms';
import { FORM_FIELD_GROUPS } from '../../Pages/Private/Health/Metrics/metricCatalog';

const LAYOUTS: HealthFormLayout[] = ['GRID', 'LIST'];
const CATALOG = FORM_FIELD_GROUPS.flatMap((group) => group.fields);

interface Health_Form_Editor_Props {
  existing: HealthForm | null;
  saving: boolean;
  onSave: (draft: HealthFormDraft) => Promise<string | null>;
  onCancel: () => void;
}

const Health_Form_Editor = ({ existing, saving, onSave, onCancel }: Health_Form_Editor_Props) => {
  const { t } = useTranslation('health');
  const [name, setName] = useState(existing?.name ?? '');
  const [fields, setFields] = useState<HealthFormField[]>(existing?.fields ?? []);
  const [layout, setLayout] = useState<HealthFormLayout>(existing?.layout ?? 'GRID');
  const [error, setError] = useState('');

  const toggle = (field: HealthFormField) => {
    setFields(fields.includes(field) ? fields.filter((item) => item !== field) : [...fields, field]);
    setError('');
  };

  const move = (index: number, step: number) => {
    const next = [...fields];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    setFields(next);
  };

  const handleSave = async () => {
    if (!name.trim() || !fields.length || saving) return;
    const ordered = layout === 'LIST' ? fields : CATALOG.filter((field) => fields.includes(field));
    const failure = await onSave({ name: name.trim(), fields: ordered, layout });
    if (failure) setError(failure);
  };

  return (
    <div className='Health_Forms_Editor'>
      <div className='Health_Forms_Grid'>
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
        <div className='Health_Forms_Field Health_Forms_Layout_Field'>
          <span className='Health_Forms_Label'>{t('forms.layout')}</span>
          <div className='Health_Forms_Layouts' role='radiogroup' aria-label={t('forms.layout')}>
            {LAYOUTS.map((option) => (
              <button
                key={option}
                type='button'
                role='radio'
                aria-checked={layout === option}
                className={layout === option ? 'active' : ''}
                onClick={() => setLayout(option)}
              >
                {t(`forms.layouts.${option}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {FORM_FIELD_GROUPS.map((group) => (
        <fieldset key={group.key} className='Health_Forms_Group'>
          <legend>{t(`forms.groups.${group.key}`)}</legend>
          {group.fields.map((field) => (
            <label key={field} className='Health_Forms_Check'>
              <input type='checkbox' checked={fields.includes(field)} onChange={() => toggle(field)} />
              {t(`bodyMetrics.names.${field}`)}
            </label>
          ))}
        </fieldset>
      ))}

      {layout === 'LIST' && fields.length > 0 && (
        <div className='Health_Forms_Order'>
          <span className='Health_Forms_Label'>{t('forms.order')}</span>
          <ol>
            {fields.map((field, index) => (
              <li key={field}>
                <span>{t(`bodyMetrics.names.${field}`)}</span>
                <button type='button' className='Health_Forms_Ghost' aria-label={t('forms.moveUp')} disabled={index === 0} onClick={() => move(index, -1)}>
                  ↑
                </button>
                <button
                  type='button'
                  className='Health_Forms_Ghost'
                  aria-label={t('forms.moveDown')}
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {error && <p className='Health_Forms_Error'>{error}</p>}

      <div className='Health_Forms_Actions'>
        <button type='button' className='Health_Forms_Ghost' onClick={onCancel} disabled={saving}>
          {t('common:actions.cancel')}
        </button>
        <button type='button' className='Health_Forms_Solid' onClick={() => void handleSave()} disabled={saving || !name.trim() || !fields.length}>
          {saving ? t('body.saving') : t('forms.saveForm')}
        </button>
      </div>
    </div>
  );
};

export default Health_Form_Editor;
