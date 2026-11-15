import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import './Mood.scss';
import { useWellbeing } from '../../../../Hooks/Health/useWellbeing';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { dateInput } from '../Shared/healthFormat';
import { splitByPeriod } from '../Wellbeing/wellbeingFormat';
import Mood_Form_Card from './Mood_Form_Card';
import Mood_Records_Card from './Mood_Records_Card';
import Mood_Trend_Card from './Mood_Trend_Card';

const Mood = () => {
  const { t } = useTranslation('health');
  const [days, setDays] = useState(30);
  const today = dateInput(new Date());
  const [selectedDay, setSelectedDay] = useState(today);
  const formRef = useRef<HTMLDivElement>(null);
  const { data, loading, saving, error, saveMood, removeMood } = useWellbeing(days, today);
  const moods = data?.moods ?? [];
  const { current, previous } = splitByPeriod(moods, (entry) => entry.day, days, today);
  const entry = moods.find((mood) => mood.day === selectedDay) ?? null;

  const editDay = (day: string) => {
    setSelectedDay(day);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header
        title={t('mood.title')}
        days={days}
        onDays={setDays}
        back={{ path: '/MyHomeLab/Health/Wellbeing', label: t('wellbeing.title') }}
      />

      {error && <div className='Health_empty'>{error}</div>}

      {!loading && data && (
        <>
          <div ref={formRef} className='Mood_Form_Anchor'>
            <Mood_Form_Card
              key={`${selectedDay}-${entry ? `${entry.mood}${entry.energy}${entry.motivation}${entry.note ?? ''}` : 'new'}`}
              day={selectedDay}
              isToday={selectedDay === today}
              maxDay={today}
              entry={entry}
              saving={saving}
              onDay={setSelectedDay}
              onSave={saveMood}
              onRemove={(day) => void removeMood(day)}
            />
          </div>

          <Mood_Trend_Card moods={current} previous={previous} days={days} />

          <Mood_Records_Card moods={current} selectedDay={selectedDay} onEdit={editDay} onRemove={(day) => void removeMood(day)} />
        </>
      )}
    </div>
  );
};

export default Mood;
