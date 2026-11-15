import { useTranslation } from 'react-i18next';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Stat from '../Shared/Health_Stat';
import Exercise_Splits_Chart from './Exercise_Splits_Chart';
import { formatPace } from './exerciseFormat';

interface Exercise_Workout_Splits_Props {
  splits: [number, number][];
}

const Exercise_Workout_Splits = ({ splits }: Exercise_Workout_Splits_Props) => {
  const { t } = useTranslation('health');
  const fastest = splits.reduce((best, split) => (split[1] < best[1] ? split : best));
  const slowest = splits.reduce((worst, split) => (split[1] > worst[1] ? split : worst));
  const average = splits.reduce((sum, split) => sum + split[1], 0) / splits.length;

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('exercise.splits.title')}</span>
          <p className='Health_card_description'>{t('exercise.splits.description')}</p>
        </div>
      </div>

      <div className='Health_Stats columns-4'>
        <Health_Stat label={t('exercise.splits.count')} value={String(splits.length)} />
        <Health_Stat label={t('exercise.splits.average')} value={formatPace(average)} />
        <Health_Stat
          highlight
          label={t('exercise.splits.fastest')}
          value={formatPace(fastest[1])}
          sub={t('exercise.splits.km', { km: fastest[0] })}
        />
        <Health_Stat
          label={t('exercise.splits.slowest')}
          value={formatPace(slowest[1])}
          sub={t('exercise.splits.km', { km: slowest[0] })}
        />
      </div>

      <div className='Health_Box'>
        <Error_Boundary>
          <Exercise_Splits_Chart splits={splits} />
        </Error_Boundary>
      </div>
    </section>
  );
};

export default Exercise_Workout_Splits;
