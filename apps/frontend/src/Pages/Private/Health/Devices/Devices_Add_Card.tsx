import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import type { DeviceKind } from '../../../../Hooks/Health/healthTypes';
import type { DeviceDraft } from '../../../../Hooks/Health/useMeasurementDevices';
import { DEVICE_KINDS } from '../Metrics/metricCatalog';

interface Devices_Add_Card_Props {
  saving: boolean;
  onAdd: (draft: DeviceDraft) => Promise<string | null>;
}

const Devices_Add_Card = ({ saving, onAdd }: Devices_Add_Card_Props) => {
  const { t } = useTranslation('health');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<DeviceKind>('SCALE');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!name.trim() || saving) return;
    const failure = await onAdd({ name: name.trim(), kind, brand: brand.trim() || null, model: model.trim() || null, notes: null });
    setError(failure ?? '');
    if (!failure) {
      setName('');
      setBrand('');
      setModel('');
    }
  };

  const text = (id: string, label: string, value: string, onChange: (value: string) => void, placeholder: string, max: number) => (
    <div className='Health_Form_Field'>
      <label htmlFor={id}>{label}</label>
      <Global_Input
        id={id}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setError('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleAdd();
        }}
      />
    </div>
  );

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('devices.addTitle')}</span>
          <p className='Health_card_description'>{t('devices.description')}</p>
        </div>
      </div>

      <div className='Health_Form Devices_Form'>
        {text('device-name', t('devices.name'), name, setName, t('devices.namePlaceholder'), 40)}
        <div className='Health_Form_Field'>
          <label htmlFor='device-kind'>{t('devices.kind')}</label>
          <Global_Dropdown
            id='device-kind'
            value={kind}
            onChange={(next) => setKind(next as DeviceKind)}
            options={DEVICE_KINDS.map((option) => ({ value: option, label: t(`devices.kinds.${option}`) }))}
          />
        </div>
        {text('device-brand', t('devices.brand'), brand, setBrand, t('devices.brandPlaceholder'), 60)}
        {text('device-model', t('devices.model'), model, setModel, t('devices.modelPlaceholder'), 60)}
        <button type='button' className='Health_Form_Save' disabled={saving || !name.trim()} onClick={() => void handleAdd()}>
          {t('devices.add')}
        </button>
      </div>

      {error && <p className='Health_Form_Error'>{error}</p>}
    </section>
  );
};

export default Devices_Add_Card;
