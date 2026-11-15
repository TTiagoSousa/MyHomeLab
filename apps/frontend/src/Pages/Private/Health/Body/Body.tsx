import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import './Body.scss';
import { useBody } from '../../../../Hooks/Health/useBody';
import type { VitalPayload } from '../../../../Hooks/Health/healthLogTypes';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { isBeforePeriod } from '../Shared/healthFormat';
import Body_Measurements_Section from './Body_Measurements_Section';
import Body_Photos_Section from './Body_Photos_Section';
import Body_Vitals_Section from './Body_Vitals_Section';
import { BODY_SECTIONS, type BodySection } from './bodyFormat';

const Body = () => {
  const { t } = useTranslation('health');
  const [days, setDays] = useState(30);
  const [section, setSection] = useState<BodySection>('measurements');
  const body = useBody(days);

  const handleAddVital = async (payload: VitalPayload) => {
    const failure = await body.addVital(payload);
    if (!failure && isBeforePeriod(payload.at, days)) setDays(0);
    return failure;
  };

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header
        title={t('body.title')}
        days={section === 'vitals' ? days : undefined}
        onDays={section === 'vitals' ? setDays : undefined}
      />

      <div className='Diary_Kinds Body_Sections'>
        {BODY_SECTIONS.map((option) => (
          <button key={option} type='button' className={option === section ? 'active' : ''} onClick={() => setSection(option)}>
            {t(`body.sections.${option}`)}
          </button>
        ))}
      </div>

      {body.error && <div className='Health_empty'>{body.error}</div>}

      {section === 'measurements' && (
        <Body_Measurements_Section
          measurements={body.measurements}
          loading={body.loading}
          saving={body.saving}
          onSave={body.saveMeasurement}
          onRemove={(id) => void body.removeMeasurement(id)}
        />
      )}

      {section === 'photos' && (
        <Body_Photos_Section
          photos={body.photos}
          loading={body.loading}
          saving={body.saving}
          onUpload={body.uploadPhoto}
          onRemove={(id) => void body.removePhoto(id)}
        />
      )}

      {section === 'vitals' && (
        <Body_Vitals_Section
          vitals={body.vitals}
          loading={body.loading}
          saving={body.saving}
          onAdd={handleAddVital}
          onRemove={(id) => void body.removeVital(id)}
        />
      )}
    </div>
  );
};

export default Body;
