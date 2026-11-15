import { useTranslation } from 'react-i18next';
import './Difficulty_Picker.scss';

interface Difficulty_Picker_Props {
  value: number | null;
  onChange: (value: number | null) => void;
  label?: string;
  compact?: boolean;
}

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const levelClass = (level: number) => {
  if (level <= 3) return 'easy';
  if (level <= 6) return 'moderate';
  if (level <= 8) return 'hard';
  return 'max';
};

const Difficulty_Picker = ({ value, onChange, label, compact = false }: Difficulty_Picker_Props) => {
  const { t } = useTranslation('health');

  return (
    <div className={`Difficulty_Picker${compact ? ' compact' : ''}`}>
      {label && (
        <span className='Difficulty_Picker_Label'>
          {label}
          <small>{value == null ? t('workoutForm.difficulty.none') : t(`workoutForm.difficulty.${levelClass(value)}`)}</small>
        </span>
      )}
      <div className='Difficulty_Picker_Options' role='radiogroup' aria-label={label ?? t('workoutForm.difficulty.label')}>
        {LEVELS.map((level) => (
          <button
            key={level}
            type='button'
            role='radio'
            aria-checked={level === value}
            className={`${levelClass(level)}${level === value ? ' active' : ''}${value != null && level < value ? ' filled' : ''}`}
            title={t(`workoutForm.difficulty.${levelClass(level)}`)}
            onClick={() => onChange(level === value ? null : level)}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Difficulty_Picker;
