import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import type { MoodEntry } from '../../../../Hooks/Health/healthLogTypes';
import { MOOD_COLORS, MOOD_FIELDS, SCALE_FACES, moodAverage } from '../Mood/moodFormat';
import Wellbeing_Metric from './Wellbeing_Metric';
import Wellbeing_Sparkline from './Wellbeing_Sparkline';
import { changeOf, formatAverage } from './wellbeingFormat';

const MOOD_PATH = '/MyHomeLab/Health/Mood';

interface Wellbeing_Mood_Card_Props {
  moods: MoodEntry[];
  previous: MoodEntry[];
  days: number;
  today: string;
}

const Wellbeing_Mood_Card = ({ moods, previous, days, today }: Wellbeing_Mood_Card_Props) => {
  const { t } = useTranslation('health');
  const navigate = useNavigate();
  const todayEntry = moods.find((entry) => entry.day === today) ?? null;

  return (
    <section className='Health_card Wellbeing_Card'>
      <button type='button' className='Wellbeing_Card_Body' onClick={() => navigate(MOOD_PATH)}>
        <span className='Wellbeing_Card_Head'>
          <span className='Health_card_title'>{t('wellbeing.mood.title')}</span>
          <span className='Wellbeing_Card_Open'>{t('wellbeing.open')} →</span>
        </span>
        <span className='Health_card_description'>{t('wellbeing.mood.description', { period: t(`periods.${days}`) })}</span>

        {!moods.length ? (
          <span className='Health_chart_empty'>{t('wellbeing.mood.empty')}</span>
        ) : (
          <>
            <span className='Wellbeing_Metrics'>
              {MOOD_FIELDS.map((field) => (
                <Wellbeing_Metric
                  key={field}
                  label={t(`mood.fields.${field}`)}
                  value={formatAverage(moodAverage(moods, field))}
                  change={changeOf(moodAverage(moods, field), moodAverage(previous, field))}
                />
              ))}
              <Wellbeing_Metric
                label={t('wellbeing.mood.logged')}
                value={String(moods.length)}
                sub={t('mood.trend.loggedSub', { count: moods.length })}
              />
            </span>
            <Error_Boundary>
              <Wellbeing_Sparkline kind='line' values={moods.map((entry) => entry.mood).reverse()} colors={[MOOD_COLORS.mood]} min={1} max={5} />
            </Error_Boundary>
          </>
        )}
      </button>

      <div className='Wellbeing_Card_Actions'>
        <span className='Wellbeing_Today'>
          {todayEntry
            ? MOOD_FIELDS.map((field) => `${SCALE_FACES[field][todayEntry[field] - 1]} ${todayEntry[field]}`).join('  ')
            : t('wellbeing.mood.todayMissing')}
        </span>
        <button type='button' className={todayEntry ? 'Health_see_all' : 'Health_Form_Save'} onClick={() => navigate(MOOD_PATH)}>
          {todayEntry ? t('wellbeing.mood.editToday') : t('wellbeing.mood.logToday')}
        </button>
      </div>
    </section>
  );
};

export default Wellbeing_Mood_Card;
