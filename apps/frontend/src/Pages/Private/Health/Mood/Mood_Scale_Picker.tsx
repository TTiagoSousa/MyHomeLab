import { useTranslation } from 'react-i18next';
import { SCALE, SCALE_FACES, type MoodField } from './moodFormat';

interface Mood_Scale_Picker_Props {
  field: MoodField;
  value: number;
  onChange: (value: number) => void;
}

const Mood_Scale_Picker = ({ field, value, onChange }: Mood_Scale_Picker_Props) => {
  const { t } = useTranslation('health');

  return (
    <div className='Mood_Scale'>
      <span className='Mood_Scale_Label'>
        {t(`mood.fields.${field}`)}
        <small>{value ? t(`mood.levels.${value}`) : t('mood.form.pick')}</small>
      </span>
      <div className='Mood_Scale_Options'>
        {SCALE.map((level) => (
          <button
            key={level}
            type='button'
            className={level === value ? 'active' : ''}
            title={t(`mood.levels.${level}`)}
            aria-label={`${t(`mood.fields.${field}`)} ${level}`}
            onClick={() => onChange(level)}
          >
            <span>{SCALE_FACES[field][level - 1]}</span>
            <small>{level}</small>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Mood_Scale_Picker;
