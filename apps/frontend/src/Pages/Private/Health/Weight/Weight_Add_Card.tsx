import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import type { CompositionField, MeasurementDevice } from '../../../../Hooks/Health/healthTypes';
import type { WeightPayload } from '../../../../Hooks/Health/useWeight';
import { browserTimeZone, dateInput, timeInput } from '../Shared/healthFormat';
import { COMPOSITION_METRICS, FIELD_INFO, parseField } from '../Metrics/metricCatalog';

type Field = 'weightKg' | CompositionField;

const FIELDS: Field[] = ['weightKg', ...COMPOSITION_METRICS];
const NO_DEVICE = 'none';

interface Weight_Add_Card_Props {
  saving: boolean;
  devices: MeasurementDevice[];
  defaultDeviceId: string | null;
  onAdd: (payload: WeightPayload) => Promise<string | null>;
}

const emptyTexts = () => Object.fromEntries(FIELDS.map((field) => [field, ''])) as Record<Field, string>;

const Weight_Add_Card = ({ saving, devices, defaultDeviceId, onAdd }: Weight_Add_Card_Props) => {
  const { t } = useTranslation('health');
  const now = new Date();
  const [texts, setTexts] = useState(emptyTexts);
  const [date, setDate] = useState(dateInput(now));
  const [time, setTime] = useState(timeInput(now));
  const [deviceChoice, setDeviceChoice] = useState<string | null>(null);
  const [showComposition, setShowComposition] = useState(false);
  const [error, setError] = useState('');

  const deviceId = deviceChoice ?? defaultDeviceId ?? NO_DEVICE;
  const values = FIELDS.map((field) => ({ field, value: parseField(field, texts[field]) }));
  const invalid = values.some(({ value }) => value != null && Number.isNaN(value));
  const filled = values.some(({ value }) => value != null && !Number.isNaN(value));
  const measuredAt = new Date(`${date}T${time}`);
  const canSave = !saving && filled && !invalid && !Number.isNaN(measuredAt.getTime());

  const handleSave = async () => {
    if (!canSave) return;
    const fields = Object.fromEntries(values.filter(({ value }) => value != null).map(({ field, value }) => [field, value]));
    const failure = await onAdd({
      ...fields,
      deviceId: deviceId === NO_DEVICE ? null : deviceId,
      measuredAt: measuredAt.toISOString(),
      timeZone: browserTimeZone(measuredAt),
    });
    if (failure) setError(failure);
    else {
      setTexts(emptyTexts());
      setError('');
    }
  };

  const input = (field: Field) => (
    <div key={field} className='Health_Form_Field'>
      <label htmlFor={`weight-${field}`}>
        {FIELD_INFO[field].unit
          ? t('body.measurements.fieldWithUnit', { field: t(`bodyMetrics.names.${field}`), unit: FIELD_INFO[field].unit })
          : t(`bodyMetrics.names.${field}`)}
      </label>
      <Global_Input
        id={`weight-${field}`}
        value={texts[field]}
        placeholder={field === 'weightKg' ? '72.5' : '—'}
        onChange={(e) => {
          setTexts({ ...texts, [field]: e.target.value });
          setError('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSave();
        }}
      />
    </div>
  );

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('weight.addTitle')}</span>
          <p className='Health_card_description'>{t('weight.addDescription')}</p>
        </div>
        <div className='Health_card_actions'>
          <button type='button' className='Health_see_all' aria-expanded={showComposition} onClick={() => setShowComposition(!showComposition)}>
            {showComposition ? t('weight.hideComposition') : t('weight.showComposition')}
          </button>
        </div>
      </div>

      <div className='Health_Form Weight_Main'>
        {input('weightKg')}
        <div className='Health_Form_Field'>
          <label htmlFor='weight-date'>{t('weight.date')}</label>
          <Global_Input id='weight-date' type='date' value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className='Health_Form_Field'>
          <label htmlFor='weight-time'>{t('weight.time')}</label>
          <Global_Input id='weight-time' type='time' value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className='Health_Form_Field'>
          <label htmlFor='weight-device'>{t('devices.device')}</label>
          <Global_Dropdown
            id='weight-device'
            value={deviceId}
            onChange={setDeviceChoice}
            options={[
              { value: NO_DEVICE, label: t('devices.none') },
              ...devices.map((device) => ({ value: device.id, label: device.name })),
            ]}
          />
        </div>
      </div>

      {showComposition && <div className='Health_Form Weight_Composition'>{COMPOSITION_METRICS.map(input)}</div>}

      {invalid && <p className='Health_Form_Error'>{t('weight.invalid')}</p>}
      {error && <p className='Health_Form_Error'>{error}</p>}

      <div className='Diary_Actions'>
        <button type='button' className='Health_Form_Save' disabled={!canSave} onClick={() => void handleSave()}>
          {saving ? t('weight.saving') : t('weight.save')}
        </button>
      </div>
    </section>
  );
};

export default Weight_Add_Card;
