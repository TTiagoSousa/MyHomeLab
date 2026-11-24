import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import type { HealthMetric, WeightEntry } from '../../../../Hooks/Health/healthTypes';
import type { MetricValuePayload } from '../../../../Hooks/Health/useHealthMetric';
import { useMeasurementDevices } from '../../../../Hooks/Health/useMeasurementDevices';
import { useWeighings } from '../../../../Hooks/Health/useWeighings';
import { browserTimeZone, dateInput, formatDay, localClock, timeInput } from '../Shared/healthFormat';
import Health_Device_Field, { NO_DEVICE } from '../Shared/Health_Device_Field';
import { COMPOSITION_METRICS, FIELD_INFO, isTapeMetric, parseField } from './metricCatalog';

const NEW_MEASUREMENT = 'new';
const TAPE_TIME = '12:00';

interface Metric_Add_Card_Props {
  metric: HealthMetric;
  saving: boolean;
  onAdd: (payload: MetricValuePayload) => Promise<string | null>;
}

const valuesIn = (entry: WeightEntry) =>
  (entry.weightKg != null ? 1 : 0) + COMPOSITION_METRICS.filter((field) => entry[field] != null).length;

const Metric_Add_Card = ({ metric, saving, onAdd }: Metric_Add_Card_Props) => {
  const { t } = useTranslation('health');
  const devices = useMeasurementDevices();
  const [savedCount, setSavedCount] = useState(0);
  const { weighings } = useWeighings(savedCount);
  const now = new Date();
  const tape = isTapeMetric(metric);
  const [text, setText] = useState('');
  const [date, setDate] = useState(dateInput(now));
  const [time, setTime] = useState(timeInput(now));
  const [deviceChoice, setDeviceChoice] = useState<string | null>(null);
  const [measurement, setMeasurement] = useState(NEW_MEASUREMENT);
  const [error, setError] = useState('');

  const name = t(`bodyMetrics.names.${metric}`);
  const unit = FIELD_INFO[metric].unit;
  const value = parseField(metric, text);
  const invalid = value != null && Number.isNaN(value);
  const joining = !tape && measurement !== NEW_MEASUREMENT;
  const deviceId = deviceChoice ?? devices.defaultOf('SCALE')?.id ?? NO_DEVICE;
  const measuredAt = new Date(`${date}T${tape ? TAPE_TIME : time}`);
  const canSave = !saving && value != null && !invalid && !Number.isNaN(measuredAt.getTime());

  const measurementOptions = [
    { value: NEW_MEASUREMENT, label: t('bodyMetrics.newMeasurement') },
    ...weighings.map((entry) => ({
      value: entry.id,
      label: [
        `${formatDay(entry.day, false)} · ${localClock(entry.measuredAt, entry.timeZone)}`,
        entry.device ?? t('devices.none'),
        t('bodyMetrics.valuesCount', { count: valuesIn(entry) }),
        entry[metric as keyof WeightEntry] != null ? t('bodyMetrics.alreadyHas') : null,
      ]
        .filter(Boolean)
        .join(' · '),
    })),
  ];

  const handleSave = async () => {
    if (!canSave || value == null) return;
    const failure = await onAdd({
      value,
      deviceId: tape || deviceId === NO_DEVICE ? null : deviceId,
      measuredAt: measuredAt.toISOString(),
      timeZone: browserTimeZone(measuredAt),
      ...(joining ? { entryId: measurement } : {}),
    });
    if (failure) setError(failure);
    else {
      setText('');
      setError('');
      setSavedCount(savedCount + 1);
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

      <div className={`Health_Form Metric_Form${tape || joining ? ' short' : ''}`}>
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
        {!tape && (
          <div className='Health_Form_Field'>
            <label htmlFor='metric-measurement'>{t('bodyMetrics.measurement')}</label>
            <Global_Dropdown id='metric-measurement' value={measurement} onChange={setMeasurement} options={measurementOptions} />
          </div>
        )}
        {!joining && (
          <div className='Health_Form_Field'>
            <label htmlFor='metric-date'>{t('weight.date')}</label>
            <Global_Input id='metric-date' type='date' value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        )}
        {!tape && !joining && (
          <>
            <div className='Health_Form_Field'>
              <label htmlFor='metric-time'>{t('weight.time')}</label>
              <Global_Input id='metric-time' type='time' value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <Health_Device_Field id='metric-device' devices={devices.devicesOf('SCALE')} value={deviceId} onChange={setDeviceChoice} />
          </>
        )}
        <button type='button' className='Health_Form_Save' disabled={!canSave} onClick={() => void handleSave()}>
          {saving ? t('weight.saving') : t('weight.save')}
        </button>
      </div>

      {joining && <p className='Health_card_description'>{t('bodyMetrics.joiningHint')}</p>}
      {invalid && <p className='Health_Form_Error'>{t('bodyMetrics.invalid', { min: FIELD_INFO[metric].min, max: FIELD_INFO[metric].max })}</p>}
      {error && <p className='Health_Form_Error'>{error}</p>}
    </section>
  );
};

export default Metric_Add_Card;
