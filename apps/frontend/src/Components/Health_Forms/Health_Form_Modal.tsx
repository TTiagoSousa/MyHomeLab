import { useTranslation } from 'react-i18next';
import './Health_Forms.scss';
import type { HealthForm } from '../../Hooks/Health/healthTypes';
import { useHealthForms } from '../../Hooks/Health/useHealthForms';
import Health_Form_Fill from './Health_Form_Fill';

interface Health_Form_Modal_Props {
  form: HealthForm;
  onClose: () => void;
}

const Health_Form_Modal = ({ form, onClose }: Health_Form_Modal_Props) => {
  const { t } = useTranslation('health');
  const { saving, submitForm } = useHealthForms();

  return (
    <div className='Health_Forms_Overlay' onClick={() => !saving && onClose()}>
      <div className='Health_Forms_Modal' role='dialog' aria-modal='true' aria-labelledby='health-form-modal-title' onClick={(e) => e.stopPropagation()}>
        <div className='Health_Forms'>
          <div>
            <span className='Health_Forms_Title' id='health-form-modal-title'>{form.name}</span>
            <p className='Health_Forms_Hint'>{t('forms.fillHint')}</p>
          </div>
          <Health_Form_Fill form={form} saving={saving} onSubmit={(submission) => submitForm(form.id, submission)} onDone={onClose} />
        </div>
      </div>
    </div>
  );
};

export default Health_Form_Modal;
