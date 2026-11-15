import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import '../Fasting/Fasting.scss';
import './Wellbeing.scss';
import { useWellbeing } from '../../../../Hooks/Health/useWellbeing';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { dateInput } from '../Shared/healthFormat';
import { fastDay, lastTarget, openFast } from '../Fasting/fastingFormat';
import Wellbeing_Fasting_Card from './Wellbeing_Fasting_Card';
import Wellbeing_Mood_Card from './Wellbeing_Mood_Card';
import { splitByPeriod } from './wellbeingFormat';

const Wellbeing = () => {
  const { t } = useTranslation('health');
  const [days, setDays] = useState(30);
  const today = dateInput(new Date());
  const { data, loading, saving, error, saveFast } = useWellbeing(days, today);
  const moods = splitByPeriod(data?.moods ?? [], (entry) => entry.day, days, today);
  const fasts = splitByPeriod(data?.fasts ?? [], fastDay, days, today);

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('wellbeing.title')} days={days} onDays={setDays} />

      {error && <div className='Health_empty'>{error}</div>}

      {!loading && data && (
        <div className='Wellbeing_Grid'>
          <Wellbeing_Mood_Card moods={moods.current} previous={moods.previous} days={days} today={today} />
          <Wellbeing_Fasting_Card
            fasts={fasts.current}
            previous={fasts.previous}
            open={openFast(data.fasts)}
            defaultTarget={lastTarget(data.fasts)}
            days={days}
            saving={saving}
            onSave={saveFast}
          />
        </div>
      )}
    </div>
  );
};

export default Wellbeing;
