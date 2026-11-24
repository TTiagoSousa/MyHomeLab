import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import { useWeight, type WeightPayload } from '../../../../Hooks/Health/useWeight';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { formatDay, isBeforePeriod } from '../Shared/healthFormat';
import Weight_Add_Card from './Weight_Add_Card';
import Weight_Height_Card from './Weight_Height_Card';
import Weight_Average_Tiles from './Weight_Average_Tiles';
import Weight_Trend_Chart from './Weight_Trend_Chart';
import Weight_Entries_Panel from './Weight_Entries_Panel';
import Weight_Devices_Card from './Weight_Devices_Card';
import Metric_Links from '../Metrics/Metric_Links';
import { COMPOSITION_METRICS } from '../Metrics/metricCatalog';
import { useMeasurementDevices } from '../../../../Hooks/Health/useMeasurementDevices';

const Weight = () => {
  const { t } = useTranslation('health');
  const [days, setDays] = useState(30);
  const { averages, entries, loading, saving, error, addWeight, removeWeight } = useWeight(days);
  const devices = useMeasurementDevices();

  const handleAdd = async (payload: WeightPayload) => {
    const failure = await addWeight(payload);
    if (!failure && isBeforePeriod(payload.measuredAt, days)) setDays(0);
    return failure;
  };

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('weight.title')} days={days} onDays={setDays} />

      <Weight_Add_Card
        saving={saving}
        devices={devices.devices}
        defaultDeviceId={devices.defaultDevice?.id ?? null}
        onAdd={handleAdd}
      />

      <Metric_Links title={t('bodyMetrics.compositionTitle')} metrics={COMPOSITION_METRICS} />

      <Weight_Height_Card refreshKey={entries.length} />

      <Weight_Devices_Card
        devices={devices.devices}
        saving={devices.saving}
        onAdd={devices.addDevice}
        onMakeDefault={devices.makeDefault}
        onRemove={devices.removeDevice}
      />

      {error && <div className='Health_empty'>{error}</div>}

      {!loading && !error && !entries.length && (
        <div className='Health_empty'>
          <span className='Health_empty_title'>{t('weight.emptyTitle')}</span>
          <span>{t('weight.emptyText')}</span>
        </div>
      )}

      {averages && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('averages.title')}</span>
              {averages.from && averages.to && (
                <p className='Health_card_description'>
                  {t('averages.weighingsBasedOn', {
                    count: averages.entries,
                    from: formatDay(averages.from, false),
                    to: formatDay(averages.to, false),
                  })}
                </p>
              )}
            </div>
          </div>
          <Weight_Average_Tiles averages={averages} />
        </section>
      )}

      {entries.length > 1 && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('weight.trendTitle')}</span>
              <p className='Health_card_description'>{t('weight.trendHint')}</p>
            </div>
          </div>
          <Error_Boundary>
            <Weight_Trend_Chart entries={entries} averageKg={averages?.avgKg ?? null} />
          </Error_Boundary>
        </section>
      )}

      {entries.length > 0 && <Weight_Entries_Panel entries={entries} onRemove={removeWeight} />}
    </div>
  );
};

export default Weight;
