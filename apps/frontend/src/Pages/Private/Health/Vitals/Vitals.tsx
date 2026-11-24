import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import '../Body/Body.scss';
import { useBody } from '../../../../Hooks/Health/useBody';
import type { VitalPayload } from '../../../../Hooks/Health/healthLogTypes';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { isBeforePeriod } from '../Shared/healthFormat';
import Body_Vitals_Section from '../Body/Body_Vitals_Section';

const Vitals = () => {
  const { t } = useTranslation('health');
  const [days, setDays] = useState(30);
  const body = useBody(days);

  const handleAdd = async (payload: VitalPayload) => {
    const failure = await body.addVital(payload);
    if (!failure && isBeforePeriod(payload.at, days)) setDays(0);
    return failure;
  };

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('body.sections.vitals')} days={days} onDays={setDays} />

      {body.error && <div className='Health_empty'>{body.error}</div>}

      <Body_Vitals_Section
        vitals={body.vitals}
        loading={body.loading}
        saving={body.saving}
        onAdd={handleAdd}
        onRemove={(id) => void body.removeVital(id)}
      />
    </div>
  );
};

export default Vitals;
