import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import { useWater } from '../../../../Hooks/Health/useWater';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { browserTimeZone, dateInput, formatDay } from '../Shared/healthFormat';
import Water_Today_Card from './Water_Today_Card';
import Water_Average_Tiles from './Water_Average_Tiles';
import Water_Trend_Chart from './Water_Trend_Chart';
import Water_Days_Panel from './Water_Days_Panel';

const DEFAULT_GOAL = 2000;

const Water = () => {
  const { t } = useTranslation('health');
  const [days, setDays] = useState(30);
  const { averages, waterDays, loading, saving, error, addWater, removeWater } = useWater(days);
  const goal = averages?.goalMl ?? DEFAULT_GOAL;
  const todayKey = dateInput(new Date());
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const selected = waterDays.find((day) => day.day === selectedDay) ?? null;
  const firstDay = new Date();
  firstDay.setDate(firstDay.getDate() - (days - 1));

  const handleAdd = (ml: number) => {
    const drankAt = selectedDay === todayKey ? new Date() : new Date(`${selectedDay}T12:00`);
    void addWater({ ml, drankAt: drankAt.toISOString(), timeZone: browserTimeZone(drankAt) });
  };

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('water.title')} days={days} onDays={setDays} />

      <Water_Today_Card
        day={selectedDay}
        isToday={selectedDay === todayKey}
        minDay={dateInput(firstDay)}
        maxDay={todayKey}
        entries={selected}
        goal={goal}
        saving={saving}
        onDay={setSelectedDay}
        onAdd={handleAdd}
        onRemove={(id) => void removeWater(id)}
      />

      {error && <div className='Health_empty'>{error}</div>}

      {!loading && !error && !averages && (
        <div className='Health_empty'>
          <span className='Health_empty_title'>{t('water.emptyTitle')}</span>
          <span>{t('water.emptyText')}</span>
        </div>
      )}

      {averages && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('averages.title')}</span>
              {averages.from && averages.to && (
                <p className='Health_card_description'>
                  {t('averages.daysBasedOn', {
                    count: averages.days,
                    from: formatDay(averages.from, false),
                    to: formatDay(averages.to, false),
                  })}
                </p>
              )}
            </div>
          </div>
          <Water_Average_Tiles averages={averages} />
        </section>
      )}

      {waterDays.length > 0 && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('water.trendTitle')}</span>
              <p className='Health_card_description'>{t('water.trendHint')}</p>
            </div>
          </div>
          <Error_Boundary>
            <Water_Trend_Chart waterDays={waterDays} goal={goal} />
          </Error_Boundary>
        </section>
      )}

      {waterDays.length > 0 && <Water_Days_Panel waterDays={waterDays} goal={goal} />}
    </div>
  );
};

export default Water;
