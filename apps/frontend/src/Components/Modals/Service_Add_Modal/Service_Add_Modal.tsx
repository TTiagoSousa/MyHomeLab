import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Service_Add_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../Inputs/Global_Dropdown/Global_Dropdown';
import { useService } from '../../../Hooks/Service/useService';
import type { CategoryWithServices, ServiceHosting } from '../../../Hooks/Categories/useCategories';
import { PREDEFINED_SERVICE_COLORS } from '../../../Constants/serviceColors';
import { SERVICE_HOSTING_OPTIONS } from '../../../Constants/serviceHosting';

interface Service_Add_Modal_Props {
  categories: CategoryWithServices[];
  defaultCategoryId: string;
  onClose: () => void;
  onSaved: () => void;
}

const Service_Add_Modal = ({ categories, defaultCategoryId, onClose, onSaved }: Service_Add_Modal_Props) => {
  const { t } = useTranslation('services');
  const [name, setName] = useState('');
  const [link, setLink] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [color, setColor] = useState(PREDEFINED_SERVICE_COLORS[0]);
  const [hosting, setHosting] = useState<ServiceHosting>('SELF_HOSTED');
  const { createService, loading } = useService();

  const canSave = name.trim() !== '' && link.trim() !== '' && abbreviation.trim() !== '';

  const handleSave = async () => {
    if (!canSave) return;

    const success = await createService({
      name: name.trim(),
      link: link.trim(),
      abbreviation: abbreviation.trim(),
      color,
      categoryId,
      hosting,
    });
    if (success) onSaved();
  };

  return (
    <div className="Service_Add_Modal_Overlay" onClick={onClose}>
      <div className="Service_Add_Modal" onClick={(e) => e.stopPropagation()}>
        <div className="Service_Add_Modal_Preview">
          <div className="Preview_Card">
            <div className="Preview_Abbreviation" style={{ backgroundColor: color }}>
              {abbreviation || '--'}
            </div>
            <div className="Preview_Info">
              <span className="Preview_Name">{name || t('form.serviceNamePlaceholder')}</span>
              <span className="Preview_Url">{link || 'https://'}</span>
            </div>
          </div>
        </div>

        <div className="Service_Add_Modal_Field">
          <label>{t('form.name')}</label>
          <Global_Input
            id="add-service-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('form.serviceNamePlaceholder')}
          />
        </div>

        <div className="Service_Add_Modal_Field">
          <label>{t('form.abbreviation')}</label>
          <Global_Input
            id="add-service-abbreviation"
            value={abbreviation}
            onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
            placeholder={t('form.abbreviationPlaceholder')}
            maxLength={2}
          />
        </div>

        <div className="Service_Add_Modal_Field">
          <label>{t('form.url')}</label>
          <Global_Input
            id="add-service-url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://"
          />
        </div>

        <div className="Service_Add_Modal_Field">
          <label>{t('form.category')}</label>
          <Global_Dropdown
            value={categoryId}
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
            onChange={setCategoryId}
            searchable
          />
        </div>

        <div className="Service_Add_Modal_Field">
          <label>{t('form.hosting')}</label>
          <div className="Service_Add_Modal_Hosting">
            {SERVICE_HOSTING_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={hosting === option.value ? 'active' : ''}
                onClick={() => setHosting(option.value)}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="Service_Add_Modal_Field">
          <label>{t('form.color')}</label>
          <div className="Service_Add_Modal_Colors">
            {PREDEFINED_SERVICE_COLORS.map((predefinedColor) => (
              <div
                key={predefinedColor}
                className={`Color_Swatch${color === predefinedColor ? ' active' : ''}`}
                style={{ backgroundColor: predefinedColor }}
                onClick={() => setColor(predefinedColor)}
              ></div>
            ))}
          </div>
        </div>

        <div className="Service_Add_Modal_Actions">
          <button className="Cancel_Button" onClick={onClose} disabled={loading}>
            {t('common:actions.cancel')}
          </button>
          <button className="Save_Button" onClick={handleSave} disabled={loading || !canSave}>
            {t('common:actions.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Service_Add_Modal;
