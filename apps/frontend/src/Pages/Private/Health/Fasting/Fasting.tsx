import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import './Fasting.scss';
import { useWellbeing } from '../../../../Hooks/Health/useWellbeing';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { dateInput } from '../Shared/healthFormat';
import { splitByPeriod } from '../Wellbeing/wellbeingFormat';
import Fasting_Log_Card from './Fasting_Log_Card';
import Fasting_Now_Card from './Fasting_Now_Card';
import Fasting_Records_Card from './Fasting_Records_Card';
import Fasting_Stats_Card from './Fasting_Stats_Card';
import { fastDay, lastTarget, openFast } from './fastingFormat';

const Fasting = () => {
  const { t } = useTranslation('health');
  const [days, setDays] = useState(30);
  const today = dateInput(new Date());
  const { data, loading, saving, error, saveFast, removeFast } = useWellbeing(days, today);
  const fasts = data?.fasts ?? [];
  const { current, previous } = splitByPeriod(fasts, fastDay, days, today);
  const defaultTarget = lastTarget(fasts);

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header
        title={t('fasting.title')}
        days={days}
        onDays={setDays}
        back={{ path: '/MyHomeLab/Health/Wellbeing', label: t('wellbeing.title') }}
      />

      {error && <div className='Health_empty'>{error}</div>}

      {!loading && data && (
        <>
          <Fasting_Now_Card open={openFast(fasts)} defaultTarget={defaultTarget} saving={saving} onSave={saveFast} />

          <Fasting_Stats_Card fasts={current} previous={previous} days={days} />

          <Fasting_Log_Card defaultTarget={defaultTarget} saving={saving} onSave={(payload) => saveFast(payload)} />

          <Fasting_Records_Card
            fasts={current}
            defaultTarget={defaultTarget}
            saving={saving}
            onSave={saveFast}
            onRemove={(id) => void removeFast(id)}
          />
        </>
      )}
    </div>
  );
};

export default Fasting;
