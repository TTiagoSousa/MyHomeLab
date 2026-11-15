import { useTranslation } from 'react-i18next';
import type { IntakePreset, IntakeSettingsPayload } from '../../../../Hooks/Health/intakesTypes';
import { INTAKE_KINDS, intakeName, kindClass, presetsOf, valuesLabel } from './intakesFormat';

interface Intakes_Presets_Visibility_Props {
  presets: IntakePreset[];
  hidden: string[];
  saving: boolean;
  onSave: (payload: IntakeSettingsPayload) => Promise<string | null>;
}

const Intakes_Presets_Visibility = ({ presets, hidden, saving, onSave }: Intakes_Presets_Visibility_Props) => {
  const { t } = useTranslation('health');

  const toggle = (id: string) => {
    const next = hidden.includes(id) ? hidden.filter((item) => item !== id) : [...hidden, id];
    void onSave({ hiddenPresets: next });
  };

  return (
    <div className='Intakes_Presets'>
      {INTAKE_KINDS.map((kind) => (
        <div key={kind} className='Intakes_Presets_Group'>
          <span className='Intakes_Presets_Kind'>{t(`intakes.kinds.${kind}`)}</span>
          <div className='Intakes_Presets_List'>
            {presetsOf(presets, kind).map((preset) => {
              const visible = !hidden.includes(preset.id);
              return (
                <button
                  key={preset.id}
                  type='button'
                  className={`Intakes_Preset_Toggle ${kindClass(kind)}${visible ? ' active' : ''}`}
                  disabled={saving}
                  aria-pressed={visible}
                  title={valuesLabel(kind, preset)}
                  onClick={() => toggle(preset.id)}
                >
                  {visible ? '✓ ' : ''}
                  {intakeName(t, preset.id, preset.name)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Intakes_Presets_Visibility;
