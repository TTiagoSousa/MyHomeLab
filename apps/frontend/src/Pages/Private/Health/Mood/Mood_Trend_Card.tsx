import { useTranslation } from 'react-i18next';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import type { MoodEntry } from '../../../../Hooks/Health/healthLogTypes';
import Health_Stat from '../Shared/Health_Stat';
import { changeOf, formatAverage, formatChange } from '../Wellbeing/wellbeingFormat';
import Mood_Chart from './Mood_Chart';
import { MOOD_FIELDS, moodAverage, type MoodField } from './moodFormat';

interface Mood_Trend_Card_Props {
  moods: MoodEntry[];
  previous: MoodEntry[];
  days: number;
}

const Mood_Trend_Card = ({ moods, previous, days }: Mood_Trend_Card_Props) => {
  const { t } = useTranslation('health');

  const changeText = (field: MoodField) => {
    const change = changeOf(moodAverage(moods, field), moodAverage(previous, field));
    return change == null ? undefined : t('wellbeing.vsPrevious', { value: formatChange(change) });
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('mood.trend.title')}</span>
          <p className='Health_card_description'>{t('mood.trend.description', { period: t(`periods.${days}`) })}</p>
        </div>
      </div>

      {!moods.length ? (
        <span className='Health_chart_empty'>{t('mood.trend.empty')}</span>
      ) : (
        <>
          <div className='Health_Stats columns-4'>
            {MOOD_FIELDS.map((field) => (
              <Health_Stat
                key={field}
                highlight={field === 'mood'}
                label={t(`mood.trend.average.${field}`)}
                value={formatAverage(moodAverage(moods, field))}
                sub={changeText(field)}
              />
            ))}
            <Health_Stat label={t('mood.trend.logged')} value={String(moods.length)} sub={t('mood.trend.loggedSub', { count: moods.length })} />
          </div>
          <Error_Boundary>
            <Mood_Chart moods={moods} />
          </Error_Boundary>
        </>
      )}
    </section>
  );
};

export default Mood_Trend_Card;
