import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IntakeKind, IntakePayload, IntakesData } from '../../../../Hooks/Health/intakesTypes';
import { browserTimeZone } from '../Shared/healthFormat';
import Intakes_Entry_Form, { type IntakeSource } from './Intakes_Entry_Form';
import Intakes_Quick_Chip from './Intakes_Quick_Chip';
import { INTAKE_KINDS, intakeName, kindClass } from './intakesFormat';

interface Intakes_Quick_Card_Props {
  data: IntakesData;
  saving: boolean;
  onSave: (payload: IntakePayload, id?: string) => Promise<string | null>;
}

const Intakes_Quick_Card = ({ data, saving, onSave }: Intakes_Quick_Card_Props) => {
  const { t } = useTranslation('health');
  const [kind, setKind] = useState<IntakeKind>('CAFFEINE');
  const [form, setForm] = useState<IntakeSource | 'custom' | null>(null);
  const hidden = new Set(data.settings.hiddenPresets);

  const sources: IntakeSource[] = [
    ...data.items
      .filter((item) => item.kind === kind)
      .map((item) => ({ kind: item.kind, presetId: null, itemId: item.id, label: item.name, dose: item })),
    ...data.presets
      .filter((preset) => preset.kind === kind && !hidden.has(preset.id))
      .map((preset) => ({ kind: preset.kind, presetId: preset.id, itemId: null, label: intakeName(t, preset.id, preset.name), dose: preset })),
  ];

  const logNow = (source: IntakeSource) => {
    const at = new Date();
    void onSave({
      at: at.toISOString(),
      timeZone: browserTimeZone(at),
      quantity: 1,
      ...(source.presetId ? { presetId: source.presetId } : {}),
      ...(source.itemId ? { itemId: source.itemId } : {}),
    });
  };

  const formKey = form === 'custom' ? 'custom' : form ? `${form.presetId ?? form.itemId}` : 'none';

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('intakes.quick.title')}</span>
          <p className='Health_card_description'>{t('intakes.quick.description')}</p>
        </div>
      </div>

      <div className='Diary_Kinds'>
        {INTAKE_KINDS.map((option) => (
          <button
            key={option}
            type='button'
            className={option === kind ? 'active' : ''}
            onClick={() => {
              setKind(option);
              setForm(null);
            }}
          >
            {t(`intakes.kinds.${option}`)}
          </button>
        ))}
      </div>

      <div className='Intakes_Quick'>
        {sources.map((source) => (
          <Intakes_Quick_Chip
            key={source.presetId ?? source.itemId}
            source={source}
            className={kindClass(kind)}
            saving={saving}
            onAdd={logNow}
            onOpen={setForm}
          />
        ))}
        <button type='button' className='Intakes_Custom_Button' onClick={() => setForm('custom')}>
          + {t('intakes.quick.custom')}
        </button>
      </div>

      {!sources.length && <span className='Health_chart_empty'>{t('intakes.quick.empty')}</span>}

      {form && (
        <Intakes_Entry_Form
          key={formKey}
          source={form === 'custom' ? null : form}
          itemIds={data.items.map((item) => item.id)}
          saving={saving}
          onSave={onSave}
          onCancel={() => setForm(null)}
        />
      )}
    </section>
  );
};

export default Intakes_Quick_Card;
