import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { VitalKind, VitalPayload, VitalReading } from '../../../../Hooks/Health/healthLogTypes';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Body_Vitals_Card from './Body_Vitals_Card';
import Body_Vitals_Chart from './Body_Vitals_Chart';
import Body_Vitals_List from './Body_Vitals_List';
import { VITAL_KINDS } from './bodyFormat';

interface Body_Vitals_Section_Props {
  vitals: VitalReading[];
  loading: boolean;
  saving: boolean;
  onAdd: (payload: VitalPayload) => Promise<string | null>;
  onRemove: (id: string) => void;
}

const Body_Vitals_Section = ({ vitals, loading, saving, onAdd, onRemove }: Body_Vitals_Section_Props) => {
  const { t } = useTranslation('health');
  const [kind, setKind] = useState<VitalKind>('BLOOD_PRESSURE');
  const readings = vitals.filter((reading) => reading.kind === kind).sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <div className='Diary_Kinds'>
        {VITAL_KINDS.map((option) => (
          <button key={option} type='button' className={option === kind ? 'active' : ''} onClick={() => setKind(option)}>
            {t(`body.vitals.kinds.${option}`)}
          </button>
        ))}
      </div>

      <Body_Vitals_Card key={kind} kind={kind} saving={saving} onAdd={onAdd} />

      {!loading && readings.length === 0 && (
        <div className='Health_empty'>
          <span className='Health_empty_title'>{t('body.vitals.emptyTitle')}</span>
          <span>{t('body.vitals.emptyText')}</span>
        </div>
      )}

      {readings.length > 1 && (
        <Error_Boundary>
          <Body_Vitals_Chart kind={kind} readings={readings} />
        </Error_Boundary>
      )}

      {readings.length > 0 && <Body_Vitals_List kind={kind} readings={readings} onRemove={onRemove} />}
    </>
  );
};

export default Body_Vitals_Section;
