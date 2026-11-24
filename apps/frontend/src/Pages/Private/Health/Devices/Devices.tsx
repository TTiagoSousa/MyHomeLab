import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import { useMeasurementDevices } from '../../../../Hooks/Health/useMeasurementDevices';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { DEVICE_KINDS } from '../Metrics/metricCatalog';
import Devices_Add_Card from './Devices_Add_Card';

const Devices = () => {
  const { t } = useTranslation('health');
  const { devices, loading, saving, devicesOf, addDevice, makeDefault, removeDevice } = useMeasurementDevices();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const run = async (action: Promise<string | null>) => setError((await action) ?? '');

  const handleRemove = (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId(null);
    void run(removeDevice(id));
  };

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('devices.title')} />

      <Devices_Add_Card saving={saving} onAdd={addDevice} />

      {error && <div className='Health_empty'>{error}</div>}

      {!loading && !devices.length && (
        <div className='Health_empty'>
          <span className='Health_empty_title'>{t('devices.emptyTitle')}</span>
          <span>{t('devices.emptyText')}</span>
        </div>
      )}

      {DEVICE_KINDS.filter((kind) => devicesOf(kind).length).map((kind) => (
        <section key={kind} className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t(`devices.kindsPlural.${kind}`)}</span>
              <p className='Health_card_description'>{t(`devices.kindHints.${kind}`)}</p>
            </div>
          </div>

          <ul className='Weight_Devices'>
            {devicesOf(kind).map((device) => (
              <li key={device.id} className='Weight_Device'>
                <span className='Weight_Device_Name'>
                  {device.name}
                  {(device.brand || device.model) && (
                    <small className='Weight_Device_Model'>{[device.brand, device.model].filter(Boolean).join(' · ')}</small>
                  )}
                </span>
                {device.isDefault ? (
                  <span className='Weight_Device_Default'>{t('devices.default')}</span>
                ) : (
                  <button type='button' className='Health_see_all' disabled={saving} onClick={() => void run(makeDefault(device.id))}>
                    {t('devices.makeDefault')}
                  </button>
                )}
                <button
                  type='button'
                  className={`Health_see_all danger${confirmId === device.id ? ' confirm' : ''}`}
                  disabled={saving}
                  onClick={() => handleRemove(device.id)}
                  onBlur={() => setConfirmId(null)}
                >
                  {confirmId === device.id ? t('devices.confirmRemove') : t('devices.remove')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default Devices;
