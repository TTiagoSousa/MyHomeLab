import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import './Body.scss';
import { useBody } from '../../../../Hooks/Health/useBody';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import Metric_Links from '../Metrics/Metric_Links';
import { TAPE_METRICS } from '../Metrics/metricCatalog';
import Body_Measurements_Section from './Body_Measurements_Section';
import Body_Photos_Section from './Body_Photos_Section';
import { BODY_SECTIONS, type BodySection } from './bodyFormat';

const Body = () => {
  const { t } = useTranslation('health');
  const [section, setSection] = useState<BodySection>('measurements');
  const body = useBody(30);

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('body.title')} />

      <div className='Diary_Kinds Body_Sections'>
        {BODY_SECTIONS.map((option) => (
          <button key={option} type='button' className={option === section ? 'active' : ''} onClick={() => setSection(option)}>
            {t(`body.sections.${option}`)}
          </button>
        ))}
      </div>

      {body.error && <div className='Health_empty'>{body.error}</div>}

      {section === 'measurements' && (
        <>
          <Body_Measurements_Section
            measurements={body.measurements}
            loading={body.loading}
            saving={body.saving}
            onSave={body.saveMeasurement}
            onRemove={(id) => void body.removeMeasurement(id)}
          />
          <Metric_Links title={t('bodyMetrics.tapeTitle')} metrics={TAPE_METRICS} />
        </>
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
    </div>
  );
};

export default Body;
