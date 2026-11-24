import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import type { MeasurementDevice } from '../../../../Hooks/Health/healthTypes';

interface Weight_Devices_Card_Props {
  devices: MeasurementDevice[];
  saving: boolean;
  onAdd: (name: string) => Promise<string | null>;
  onMakeDefault: (id: string) => Promise<string | null>;
  onRemove: (id: string) => Promise<string | null>;
}

const Weight_Devices_Card = ({ devices, saving, onAdd, onMakeDefault, onRemove }: Weight_Devices_Card_Props) => {
  const { t } = useTranslation('health');
  const [name, setName] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!name.trim() || saving) return;
    const failure = await onAdd(name.trim());
    setError(failure ?? '');
    if (!failure) setName('');
  };

  const handleRemove = async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId(null);
    setError((await onRemove(id)) ?? '');
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('devices.title')}</span>
          <p className='Health_card_description'>{t('devices.description')}</p>
        </div>
      </div>

      {devices.length > 0 && (
        <ul className='Weight_Devices'>
          {devices.map((device) => (
            <li key={device.id} className='Weight_Device'>
              <span className='Weight_Device_Name'>{device.name}</span>
              {device.isDefault ? (
                <span className='Weight_Device_Default'>{t('devices.default')}</span>
              ) : (
                <button type='button' className='Health_see_all' disabled={saving} onClick={() => void onMakeDefault(device.id).then((failure) => setError(failure ?? ''))}>
                  {t('devices.makeDefault')}
                </button>
              )}
              <button
                type='button'
                className={`Health_see_all danger${confirmId === device.id ? ' confirm' : ''}`}
                disabled={saving}
                onClick={() => void handleRemove(device.id)}
                onBlur={() => setConfirmId(null)}
              >
                {confirmId === device.id ? t('devices.confirmRemove') : t('devices.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className='Health_Form Weight_Device_Form'>
        <div className='Health_Form_Field'>
          <label htmlFor='device-name'>{t('devices.name')}</label>
          <Global_Input
            id='device-name'
            value={name}
            maxLength={40}
            placeholder={t('devices.namePlaceholder')}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAdd();
            }}
          />
        </div>
        <button type='button' className='Health_Form_Save' disabled={saving || !name.trim()} onClick={() => void handleAdd()}>
          {t('devices.add')}
        </button>
      </div>

      {error && <p className='Health_Form_Error'>{error}</p>}
    </section>
  );
};

export default Weight_Devices_Card;
