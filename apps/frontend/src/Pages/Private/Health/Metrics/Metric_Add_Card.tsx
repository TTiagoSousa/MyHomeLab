import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import type { HealthMetric } from '../../../../Hooks/Health/healthTypes';
import type { MetricValuePayload } from '../../../../Hooks/Health/useHealthMetric';
import { useMeasurementDevices } from '../../../../Hooks/Health/useMeasurementDevices';
import { browserTimeZone, dateInput, timeInput } from '../Shared/healthFormat';
import { FIELD_INFO, isTapeMetric, parseField } from './metricCatalog';

const NO_DEVICE = 'none';
const TAPE_TIME = '12:00';

interface Metric_Add_Card_Props {
  metric: HealthMetric;
  saving: boolean;
  onAdd: (payload: MetricValuePayload) => Promise<string | null>;
}

const Metric_Add_Card = ({ metric, saving, onAdd }: Metric_Add_Card_Props) => {
  const { t } = useTranslation('health');
  const { devices, defaultDevice } = useMeasurementDevices();
  const now = new Date();
  const tape = isTapeMetric(metric);
  const [text, setText] = useState('');
  const [date, setDate] = useState(dateInput(now));
  const [time, setTime] = useState(timeInput(now));
  const [deviceChoice, setDeviceChoice] = useState<string | null>(null);
  const [error, setError] = useState('');

  const name = t(`bodyMetrics.names.${metric}`);
  const unit = FIELD_INFO[metric].unit;
  const value = parseField(metric, text);
  const invalid = value != null && Number.isNaN(value);
  const deviceId = deviceChoice ?? defaultDevice?.id ?? NO_DEVICE;
  const measuredAt = new Date(`${date}T${tape ? TAPE_TIME : time}`);
  const canSave = !saving && value != null && !invalid && !Number.isNaN(measuredAt.getTime());

  const handleSave = async () => {
    if (!canSave || value == null) return;
    const failure = await onAdd({
      value,
      deviceId: tape || deviceId === NO_DEVICE ? null : deviceId,
      measuredAt: measuredAt.toISOString(),
      timeZone: browserTimeZone(measuredAt),
    });
    if (failure) setError(failure);
    else {
      setText('');
      setError('');
    }
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('bodyMetrics.addTitle', { name })}</span>
          <p className='Health_card_description'>
            {t(tape ? 'bodyMetrics.addTapeHint' : 'bodyMetrics.addScaleHint', { min: FIELD_INFO[metric].min, max: FIELD_INFO[metric].max })}
          </p>
        </div>
      </div>

      <div className={`Health_Form Metric_Form${tape ? ' tape' : ''}`}>
        <div className='Health_Form_Field'>
          <label htmlFor='metric-value'>{unit ? t('body.measurements.fieldWithUnit', { field: name, unit }) : name}</label>
          <Global_Input
            id='metric-value'
            value={text}
            placeholder='—'
            onChange={(e) => {
              setText(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSave();
            }}
          />
        </div>
        <div className='Health_Form_Field'>
          <label htmlFor='metric-date'>{t('weight.date')}</label>
          <Global_Input id='metric-date' type='date' value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {!tape && (
          <>
            <div className='Health_Form_Field'>
              <label htmlFor='metric-time'>{t('weight.time')}</label>
              <Global_Input id='metric-time' type='time' value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className='Health_Form_Field'>
              <label htmlFor='metric-device'>{t('devices.device')}</label>
              <Global_Dropdown
                id='metric-device'
                value={deviceId}
                onChange={setDeviceChoice}
                options={[
                  { value: NO_DEVICE, label: t('devices.none') },
                  ...devices.map((device) => ({ value: device.id, label: device.name })),
                ]}
              />
            </div>
          </>
        )}
        <button type='button' className='Health_Form_Save' disabled={!canSave} onClick={() => void handleSave()}>
          {saving ? t('weight.saving') : t('weight.save')}
        </button>
      </div>

      {invalid && <p className='Health_Form_Error'>{t('bodyMetrics.invalid', { min: FIELD_INFO[metric].min, max: FIELD_INFO[metric].max })}</p>}
      {error && <p className='Health_Form_Error'>{error}</p>}
    </section>
  );
};

export default Metric_Add_Card;
