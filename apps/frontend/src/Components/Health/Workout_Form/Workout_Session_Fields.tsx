import { useTranslation } from 'react-i18next';
import './Workout_Form.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import Difficulty_Picker from '../Difficulty_Picker/Difficulty_Picker';
import { sessionMinutes, type SessionForm } from './workoutForm';

interface Workout_Session_Fields_Props {
  idPrefix: string;
  form: SessionForm;
  onChange: (change: Partial<SessionForm>) => void;
}

const Workout_Session_Fields = ({ idPrefix, form, onChange }: Workout_Session_Fields_Props) => {
  const { t } = useTranslation('health');
  const minutes = sessionMinutes(form);
  const hasEnd = form.end.trim() !== '';

  const field = (key: 'date' | 'start' | 'end' | 'duration' | 'calories', label: string, type: string) => (
    <div className='Workout_Form_Field'>
      <label htmlFor={`${idPrefix}-${key}`}>{label}</label>
      <Global_Input
        id={`${idPrefix}-${key}`}
        type={type}
        value={key === 'duration' && hasEnd ? (minutes != null && minutes > 0 ? String(minutes) : '') : form[key]}
        disabled={key === 'duration' && hasEnd}
        placeholder={key === 'calories' ? t('workoutForm.caloriesAuto') : ''}
        onChange={(e) => onChange({ [key]: e.target.value })}
      />
    </div>
  );

  return (
    <div className='Workout_Session_Fields'>
      <div className='Workout_Form_Grid three'>
        {field('date', t('exercise.manual.date'), 'date')}
        {field('start', t('workoutForm.start'), 'time')}
        {field('end', t('workoutForm.end'), 'time')}
      </div>

      <div className='Workout_Form_Grid'>
        {field('duration', hasEnd ? t('workoutForm.durationFromEnd') : t('exercise.manual.duration'), 'number')}
        {field('calories', t('exercise.manual.calories'), 'number')}
      </div>

      <Difficulty_Picker
        label={t('workoutForm.difficulty.label')}
        value={form.difficulty}
        onChange={(difficulty) => onChange({ difficulty })}
      />
    </div>
  );
};

export default Workout_Session_Fields;
