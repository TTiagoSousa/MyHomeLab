import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import './Intakes.scss';
import { useIntakes } from '../../../../Hooks/Health/useIntakes';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { dateInput } from '../Shared/healthFormat';
import Intakes_History_Card from './Intakes_History_Card';
import Intakes_Quick_Card from './Intakes_Quick_Card';
import Intakes_Settings_Card from './Intakes_Settings_Card';
import Intakes_Stats_Card from './Intakes_Stats_Card';
import Intakes_Today_Card from './Intakes_Today_Card';
import { weekDrinks } from './intakesFormat';

const Intakes = () => {
  const { t } = useTranslation('health');
  const [days, setDays] = useState(30);
  const { data, loading, saving, error, saveEntry, removeEntry, saveItem, removeItem, saveSettings } = useIntakes(days);
  const now = new Date();
  const todayKey = dateInput(now);
  const today = data?.days.find((day) => day.day === todayKey) ?? null;
  const itemIds = data?.items.map((item) => item.id) ?? [];

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('intakes.title')} days={days} onDays={setDays} />

      {error && <div className='Health_empty'>{error}</div>}
      {loading && !data && <div className='Health_empty'>{t('intakes.loading')}</div>}

      {data && (
        <>
          <Intakes_Today_Card today={today} weekDrinks={weekDrinks(data.days, now)} settings={data.settings} />
          <Intakes_Quick_Card data={data} saving={saving} onSave={saveEntry} />
          {data.entries.length > 0 && <Intakes_Stats_Card data={data} days={days} />}
          <Intakes_History_Card
            entries={data.entries}
            days={data.days}
            itemIds={itemIds}
            saving={saving}
            onSave={saveEntry}
            onRemove={(id) => void removeEntry(id)}
          />
          <Intakes_Settings_Card
            data={data}
            saving={saving}
            onSaveSettings={saveSettings}
            onSaveItem={saveItem}
            onRemoveItem={(id) => void removeItem(id)}
          />
        </>
      )}
    </div>
  );
};

export default Intakes;
