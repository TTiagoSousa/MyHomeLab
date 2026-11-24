import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Health_Forms.scss';
import type { HealthForm } from '../../Hooks/Health/healthTypes';
import { useHealthForms } from '../../Hooks/Health/useHealthForms';
import Health_Form_Editor from './Health_Form_Editor';
import Health_Form_Fill from './Health_Form_Fill';

type View = { mode: 'list' } | { mode: 'edit'; form: HealthForm | null } | { mode: 'fill'; form: HealthForm };

interface Health_Forms_Panel_Props {
  onSaved: () => void;
}

const Health_Forms_Panel = ({ onSaved }: Health_Forms_Panel_Props) => {
  const { t } = useTranslation('health');
  const { forms, loading, saving, saveForm, removeForm, submitForm } = useHealthForms();
  const [view, setView] = useState<View>({ mode: 'list' });
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleRemove = (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId(null);
    void removeForm(id);
  };

  if (view.mode === 'edit') {
    return (
      <div className='Health_Forms'>
        <span className='Health_Forms_Title'>{view.form ? t('forms.editTitle') : t('forms.newTitle')}</span>
        <Health_Form_Editor
          existing={view.form}
          saving={saving}
          onCancel={() => setView({ mode: 'list' })}
          onSave={async (draft) => {
            const failure = await saveForm(draft, view.form?.id);
            if (!failure) setView({ mode: 'list' });
            return failure;
          }}
        />
      </div>
    );
  }

  if (view.mode === 'fill') {
    return (
      <div className='Health_Forms'>
        <span className='Health_Forms_Title'>{view.form.name}</span>
        <Health_Form_Fill
          form={view.form}
          saving={saving}
          onSubmit={(submission) => submitForm(view.form.id, submission)}
          onDone={() => {
            onSaved();
            setView({ mode: 'list' });
          }}
        />
      </div>
    );
  }

  return (
    <div className='Health_Forms'>
      <div className='Health_Forms_Head'>
        <div>
          <span className='Health_Forms_Title'>{t('forms.title')}</span>
          <p className='Health_Forms_Hint'>{t('forms.description')}</p>
        </div>
        <button type='button' className='Health_Forms_Solid' onClick={() => setView({ mode: 'edit', form: null })}>
          + {t('forms.new')}
        </button>
      </div>

      {!loading && !forms.length && <p className='Health_Forms_Hint'>{t('forms.empty')}</p>}

      <ul className='Health_Forms_List'>
        {forms.map((form) => (
          <li key={form.id} className='Health_Forms_Item'>
            <button type='button' className='Health_Forms_Open' onClick={() => setView({ mode: 'fill', form })}>
              <strong>{form.name}</strong>
              <span>{form.fields.map((field) => t(`bodyMetrics.names.${field}`)).join(' · ')}</span>
            </button>
            <button type='button' className='Health_Forms_Ghost' onClick={() => setView({ mode: 'edit', form })}>
              {t('forms.edit')}
            </button>
            <button
              type='button'
              className={`Health_Forms_Ghost danger${confirmId === form.id ? ' confirm' : ''}`}
              onClick={() => handleRemove(form.id)}
              onBlur={() => setConfirmId(null)}
            >
              {confirmId === form.id ? t('forms.confirmRemove') : t('forms.remove')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Health_Forms_Panel;
