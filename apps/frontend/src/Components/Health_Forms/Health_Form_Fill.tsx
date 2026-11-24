import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../Inputs/Global_Input/Global_Input';
import type { HealthForm, HealthFormField } from '../../Hooks/Health/healthTypes';
import type { HealthFormSubmission } from '../../Hooks/Health/useHealthForms';
import { useMeasurementDevices } from '../../Hooks/Health/useMeasurementDevices';
import { browserTimeZone, dateInput, timeInput } from '../../Pages/Private/Health/Shared/healthFormat';
import { FIELD_INFO, SCALE_FIELDS, parseField } from '../../Pages/Private/Health/Metrics/metricCatalog';
import Health_Device_Field, { NO_DEVICE } from '../../Pages/Private/Health/Shared/Health_Device_Field';

interface Health_Form_Fill_Props {
  form: HealthForm;
  saving: boolean;
  onSubmit: (submission: HealthFormSubmission) => Promise<string | null>;
  onDone: () => void;
}

const columnsFor = (count: number) => {
  if (count <= 3) return count;
  if (count % 3 === 0) return 3;
  return count % 2 === 0 ? 2 : 3;
};

const inputId = (field: HealthFormField) => `health-form-${field}`;

const Health_Form_Fill = ({ form, saving, onSubmit, onDone }: Health_Form_Fill_Props) => {
  const { t } = useTranslation('health');
  const devices = useMeasurementDevices();
  const now = new Date();
  const [texts, setTexts] = useState<Partial<Record<HealthFormField, string>>>({});
  const [date, setDate] = useState(dateInput(now));
  const [time, setTime] = useState(timeInput(now));
  const [deviceChoice, setDeviceChoice] = useState<string | null>(null);
  const [error, setError] = useState('');

  const usesScale = form.fields.some((field) => SCALE_FIELDS.includes(field));
  const deviceId = deviceChoice ?? devices.defaultOf('SCALE')?.id ?? NO_DEVICE;
  const list = form.layout === 'LIST';
  const values = form.fields.map((field) => ({ field, value: parseField(field, texts[field] ?? '') }));
  const invalid = values.some(({ value }) => value != null && Number.isNaN(value));
  const filled = values.some(({ value }) => value != null && !Number.isNaN(value));
  const measuredAt = new Date(`${date}T${time}`);
  const canSave = !saving && filled && !invalid && !Number.isNaN(measuredAt.getTime());

  const handleSave = async () => {
    if (!canSave) return;
    const failure = await onSubmit({
      values: Object.fromEntries(values.filter(({ value }) => value != null).map(({ field, value }) => [field, value])),
      deviceId: deviceId === NO_DEVICE ? null : deviceId,
      measuredAt: measuredAt.toISOString(),
      timeZone: browserTimeZone(measuredAt),
    });
    if (failure) setError(failure);
    else onDone();
  };

  const handleEnter = (index: number) => {
    const next = form.fields[index + 1];
    if (next) document.getElementById(inputId(next))?.focus();
    else void handleSave();
  };

  return (
    <div className='Health_Forms_Fill'>
      <div className='Health_Forms_Grid'>
        <div className='Health_Forms_Field'>
          <label htmlFor='health-form-date'>{t('weight.date')}</label>
          <Global_Input id='health-form-date' type='date' value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className='Health_Forms_Field'>
          <label htmlFor='health-form-time'>{t('weight.time')}</label>
          <Global_Input id='health-form-time' type='time' value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        {usesScale && (
          <Health_Device_Field
            id='health-form-device'
            className='Health_Forms_Field'
            devices={devices.devicesOf('SCALE')}
            value={deviceId}
            onChange={setDeviceChoice}
          />
        )}
      </div>

      <div
        className={list ? 'Health_Forms_List_Fields' : 'Health_Forms_Grid'}
        style={list ? undefined : ({ '--form-columns': columnsFor(form.fields.length) } as CSSProperties)}
      >
        {form.fields.map((field, index) => (
          <div key={field} className='Health_Forms_Field'>
            <label htmlFor={inputId(field)}>
              {FIELD_INFO[field].unit
                ? t('body.measurements.fieldWithUnit', { field: t(`bodyMetrics.names.${field}`), unit: FIELD_INFO[field].unit })
                : t(`bodyMetrics.names.${field}`)}
            </label>
            <Global_Input
              id={inputId(field)}
              value={texts[field] ?? ''}
              placeholder='—'
              onChange={(e) => {
                setTexts({ ...texts, [field]: e.target.value });
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEnter(index);
              }}
            />
          </div>
        ))}
      </div>

      {invalid && <p className='Health_Forms_Error'>{t('weight.invalid')}</p>}
      {error && <p className='Health_Forms_Error'>{error}</p>}

      <div className='Health_Forms_Actions'>
        <button type='button' className='Health_Forms_Ghost' onClick={onDone} disabled={saving}>
          {t('common:actions.cancel')}
        </button>
        <button type='button' className='Health_Forms_Solid' onClick={() => void handleSave()} disabled={!canSave}>
          {saving ? t('body.saving') : t('body.save')}
        </button>
      </div>
    </div>
  );
};

export default Health_Form_Fill;
