import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import { useStressDays } from '../../../../Hooks/Health/useStressDays';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { formatDay } from '../Shared/healthFormat';
import Stress_Average_Tiles from './Stress_Average_Tiles';
import Stress_Trend_Chart from './Stress_Trend_Chart';
import Stress_Day_Detail from './Stress_Day_Detail';
import Stress_Days_Panel from './Stress_Days_Panel';
import Stress_All_Days_Modal from './Stress_All_Days_Modal';

const Stress = () => {
  const { t } = useTranslation('health');
  const detailRef = useRef<HTMLDivElement>(null);
  const [days, setDays] = useState(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const { averages, stressDays, loading, error } = useStressDays(days);

  const activeId = selectedId ?? stressDays[0]?.id ?? null;

  const openDay = (id: string) => {
    setSelectedId(id);
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('stress.title')} days={days} onDays={setDays} />

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
          <Stress_Average_Tiles averages={averages} detailed />
        </section>
      )}

      {averages && averages.days > 0 && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('stress.trendTitle')}</span>
              <p className='Health_card_description'>{t('stress.trendHint')}</p>
            </div>
          </div>
          <Error_Boundary>
            <Stress_Trend_Chart stressDays={stressDays} selectedId={activeId} onSelect={setSelectedId} />
          </Error_Boundary>
        </section>
      )}

      {averages && (
        <div ref={detailRef} className='Health_anchor'>
          <Stress_Day_Detail dayId={activeId} />
        </div>
      )}

      {averages && (
        <Stress_Days_Panel
          stressDays={stressDays}
          selectedId={activeId}
          onSelect={openDay}
          onSeeAll={() => setAllOpen(true)}
        />
      )}

      {allOpen && <Stress_All_Days_Modal selectedId={activeId} onSelect={openDay} onClose={() => setAllOpen(false)} />}
    </div>
  );
};

export default Stress;
