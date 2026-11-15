import { useTranslation } from 'react-i18next';
import type { BodyMeasurement, BodyMeasurementPayload } from '../../../../Hooks/Health/healthLogTypes';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Body_Measurements_Card from './Body_Measurements_Card';
import Body_Measurement_Chart from './Body_Measurement_Chart';
import Body_Measurements_Table from './Body_Measurements_Table';

interface Body_Measurements_Section_Props {
  measurements: BodyMeasurement[];
  loading: boolean;
  saving: boolean;
  onSave: (payload: BodyMeasurementPayload) => Promise<string | null>;
  onRemove: (id: string) => void;
}

const Body_Measurements_Section = ({ measurements, loading, saving, onSave, onRemove }: Body_Measurements_Section_Props) => {
  const { t } = useTranslation('health');

  return (
    <>
      {!loading && (
        <Body_Measurements_Card measurements={measurements} saving={saving} onSave={onSave} />
      )}

      {!loading && measurements.length === 0 && (
        <div className='Health_empty'>
          <span className='Health_empty_title'>{t('body.measurements.emptyTitle')}</span>
          <span>{t('body.measurements.emptyText')}</span>
        </div>
      )}

      {measurements.length > 1 && (
        <Error_Boundary>
          <Body_Measurement_Chart measurements={measurements} />
        </Error_Boundary>
      )}

      {measurements.length > 0 && <Body_Measurements_Table measurements={measurements} onRemove={onRemove} />}
    </>
  );
};

export default Body_Measurements_Section;
