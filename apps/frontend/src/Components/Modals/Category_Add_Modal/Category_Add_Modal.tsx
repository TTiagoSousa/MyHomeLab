import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Category_Add_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useCategory } from '../../../Hooks/Categories/useCategory';

interface Category_Add_Modal_Props {
  onClose: () => void;
  onSaved: () => void;
}

const Category_Add_Modal = ({ onClose, onSaved }: Category_Add_Modal_Props) => {
  const { t } = useTranslation('services');
  const [name, setName] = useState('');
  const { createCategory, loading } = useCategory();

  const handleSave = async () => {
    if (!name.trim()) return;

    const success = await createCategory(name.trim());
    if (success) onSaved();
  };

  return (
    <div className="Category_Add_Modal_Overlay" onClick={onClose}>
      <div className="Category_Add_Modal" onClick={(e) => e.stopPropagation()}>
        <span className="Category_Add_Modal_Title">{t('categoryModal.title')}</span>

        <div className="Category_Add_Modal_Field">
          <label>{t('form.name')}</label>
          <Global_Input
            id="add-category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('form.categoryNamePlaceholder')}
          />
        </div>

        <div className="Category_Add_Modal_Actions">
          <button className="Cancel_Button" onClick={onClose} disabled={loading}>
            {t('common:actions.cancel')}
          </button>
          <button className="Save_Button" onClick={handleSave} disabled={loading}>
            {t('common:actions.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Category_Add_Modal;
