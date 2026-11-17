import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Docs_Name_Input_Props {
  initial?: string;
  placeholder: string;
  onSave: (name: string) => Promise<unknown> | void;
  onCancel: () => void;
}

const Docs_Name_Input = ({ initial = '', placeholder, onSave, onCancel }: Docs_Name_Input_Props) => {
  const { t } = useTranslation('docs');
  const [name, setName] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    await onSave(trimmed);
    setSaving(false);
  };

  return (
    <form
      className='Docs_Name_Input'
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <input
        autoFocus
        value={name}
        maxLength={80}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onCancel();
        }}
      />
      <button type='submit' className='Save_Button' disabled={!name.trim() || saving}>
        {t('actions.save')}
      </button>
      <button type='button' className='Cancel_Button' onClick={onCancel} disabled={saving}>
        {t('actions.cancel')}
      </button>
    </form>
  );
};

export default Docs_Name_Input;
