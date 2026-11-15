import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Service_Edit_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../Inputs/Global_Dropdown/Global_Dropdown';
import { useService } from '../../../Hooks/Service/useService';
import type { CategoryWithServices, Service, ServiceHosting } from '../../../Hooks/Categories/useCategories';
import { PREDEFINED_SERVICE_COLORS } from '../../../Constants/serviceColors';
import { SERVICE_HOSTING_OPTIONS } from '../../../Constants/serviceHosting';

interface Service_Edit_Modal_Props {
  service: Service;
  categories: CategoryWithServices[];
  onClose: () => void;
  onSaved: () => void;
}

const Service_Edit_Modal = ({ service, categories, onClose, onSaved }: Service_Edit_Modal_Props) => {
  const { t } = useTranslation('services');
  const [name, setName] = useState(service.name);
  const [link, setLink] = useState(service.link);
  const [categoryId, setCategoryId] = useState(service.categoryId);
  const [color, setColor] = useState(service.color);
  const [hosting, setHosting] = useState<ServiceHosting>(service.hosting);
  const { updateService, deleteService, loading } = useService();

  const handleSave = async () => {
    const success = await updateService(service.id, { name, link, categoryId, color, hosting });
    if (success) onSaved();
  };

  const handleDelete = async () => {
    const success = await deleteService(service.id);
    if (success) onSaved();
  };

  return (
    <div className="Service_Edit_Modal_Overlay" onClick={onClose}>
      <div className="Service_Edit_Modal" onClick={(e) => e.stopPropagation()}>
        <div className="Service_Edit_Modal_Preview">
          <div className="Preview_Card">
            <div className="Preview_Abbreviation" style={{ backgroundColor: color }}>
              {service.abbreviation}
            </div>
            <div className="Preview_Info">
              <span className="Preview_Name">{name || t('form.serviceNamePlaceholder')}</span>
              <span className="Preview_Url">{link || 'https://'}</span>
            </div>
          </div>
        </div>

        <div className="Service_Edit_Modal_Field">
          <label>{t('form.name')}</label>
          <Global_Input
            id="edit-service-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="Service_Edit_Modal_Field">
          <label>{t('form.url')}</label>
          <Global_Input
            id="edit-service-url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </div>

        <div className="Service_Edit_Modal_Field">
          <label>{t('form.category')}</label>
          <Global_Dropdown
            value={categoryId}
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
            onChange={setCategoryId}
            searchable
          />
        </div>

        <div className="Service_Edit_Modal_Field">
          <label>{t('form.hosting')}</label>
          <div className="Service_Edit_Modal_Hosting">
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

        <div className="Service_Edit_Modal_Field">
          <label>{t('form.color')}</label>
          <div className="Service_Edit_Modal_Colors">
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

        <button className="Service_Edit_Modal_Delete" onClick={handleDelete} disabled={loading}>
          {t('common:actions.delete')}
        </button>

        <div className="Service_Edit_Modal_Actions">
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

export default Service_Edit_Modal;
