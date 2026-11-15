import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IntakeItemPayload, IntakeSettingsPayload, IntakesData } from '../../../../Hooks/Health/intakesTypes';
import Intakes_Items_Manager from './Intakes_Items_Manager';
import Intakes_Limits_Form from './Intakes_Limits_Form';
import Intakes_Presets_Visibility from './Intakes_Presets_Visibility';

interface Intakes_Settings_Card_Props {
  data: IntakesData;
  saving: boolean;
  onSaveSettings: (payload: IntakeSettingsPayload) => Promise<string | null>;
  onSaveItem: (payload: IntakeItemPayload, id?: string) => Promise<string | null>;
  onRemoveItem: (id: string) => void;
}

const Intakes_Settings_Card = ({ data, saving, onSaveSettings, onSaveItem, onRemoveItem }: Intakes_Settings_Card_Props) => {
  const { t } = useTranslation('health');
  const [open, setOpen] = useState(false);

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('intakes.settings.title')}</span>
          <p className='Health_card_description'>{t('intakes.settings.description')}</p>
        </div>
        <button type='button' className='Health_see_all' aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? t('intakes.settings.hide') : t('intakes.settings.show')}
        </button>
      </div>

      {open && (
        <>
          <div className='Intakes_Settings_Section'>
            <span className='Health_Section_Label'>{t('intakes.settings.limits')}</span>
            <Intakes_Limits_Form key={`${data.settings.caffeineLimitMg}-${data.settings.alcoholLimitWeek}`} settings={data.settings} saving={saving} onSave={onSaveSettings} />
            <p className='Intakes_Note'>{t('intakes.settings.note')}</p>
          </div>

          <div className='Intakes_Settings_Section'>
            <span className='Health_Section_Label'>{t('intakes.settings.presets')}</span>
            <p className='Health_card_description'>{t('intakes.settings.presetsHint')}</p>
            <Intakes_Presets_Visibility presets={data.presets} hidden={data.settings.hiddenPresets} saving={saving} onSave={onSaveSettings} />
          </div>

          <div className='Intakes_Settings_Section'>
            <span className='Health_Section_Label'>{t('intakes.items.title')}</span>
            <p className='Health_card_description'>{t('intakes.items.description')}</p>
            <Intakes_Items_Manager items={data.items} saving={saving} onSave={onSaveItem} onRemove={onRemoveItem} />
          </div>
        </>
      )}
    </section>
  );
};

export default Intakes_Settings_Card;
