import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import { useBloodOxygenDays } from '../../../../Hooks/Health/useBloodOxygenDays';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { formatDay } from '../Shared/healthFormat';
import Oxygen_Average_Tiles from './Oxygen_Average_Tiles';
import Oxygen_Trend_Chart from './Oxygen_Trend_Chart';
import Oxygen_Day_Detail from './Oxygen_Day_Detail';
import Oxygen_Days_Panel from './Oxygen_Days_Panel';
import Oxygen_All_Days_Modal from './Oxygen_All_Days_Modal';

const Oxygen = () => {
  const { t } = useTranslation('health');
  const detailRef = useRef<HTMLDivElement>(null);
  const [days, setDays] = useState(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const { averages, oxygenDays, loading, error } = useBloodOxygenDays(days);

  const activeId = selectedId ?? oxygenDays[0]?.id ?? null;

  const openDay = (id: string) => {
    setSelectedId(id);
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('oxygen.title')} days={days} onDays={setDays} />

      {error && <div className='Health_empty'>{error}</div>}

      {!loading && !error && !averages && (
        <div className='Health_empty'>
          <span className='Health_empty_title'>{t('empty.title')}</span>
          <span>{t('empty.text')}</span>
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
          <Oxygen_Average_Tiles averages={averages} detailed />
        </section>
      )}

      {averages && averages.days > 0 && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('oxygen.trendTitle')}</span>
              <p className='Health_card_description'>{t('oxygen.trendHint')}</p>
            </div>
          </div>
          <Error_Boundary>
            <Oxygen_Trend_Chart oxygenDays={oxygenDays} selectedId={activeId} onSelect={setSelectedId} />
          </Error_Boundary>
        </section>
      )}

      {averages && (
        <div ref={detailRef} className='Health_anchor'>
          <Oxygen_Day_Detail dayId={activeId} />
        </div>
      )}

      {averages && (
        <Oxygen_Days_Panel
          oxygenDays={oxygenDays}
          selectedId={activeId}
          onSelect={openDay}
          onSeeAll={() => setAllOpen(true)}
        />
      )}

      {allOpen && <Oxygen_All_Days_Modal selectedId={activeId} onSelect={openDay} onClose={() => setAllOpen(false)} />}
    </div>
  );
};

export default Oxygen;
