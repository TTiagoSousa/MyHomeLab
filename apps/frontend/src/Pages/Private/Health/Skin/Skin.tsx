import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import { useSkinTemperatureDays } from '../../../../Hooks/Health/useSkinTemperatureDays';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { formatDay } from '../Shared/healthFormat';
import Skin_Average_Tiles from './Skin_Average_Tiles';
import Skin_Trend_Chart from './Skin_Trend_Chart';
import Skin_Day_Detail from './Skin_Day_Detail';
import Skin_Days_Panel from './Skin_Days_Panel';
import Skin_All_Days_Modal from './Skin_All_Days_Modal';

const Skin = () => {
  const { t } = useTranslation('health');
  const detailRef = useRef<HTMLDivElement>(null);
  const [days, setDays] = useState(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const { averages, temperatureDays, loading, error } = useSkinTemperatureDays(days);

  const activeId = selectedId ?? temperatureDays[0]?.id ?? null;

  const openDay = (id: string) => {
    setSelectedId(id);
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('skin.title')} days={days} onDays={setDays} />

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
          <Skin_Average_Tiles averages={averages} detailed />
        </section>
      )}

      {averages && averages.days > 0 && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('skin.trendTitle')}</span>
              <p className='Health_card_description'>{t('skin.trendHint')}</p>
            </div>
          </div>
          <Error_Boundary>
            <Skin_Trend_Chart temperatureDays={temperatureDays} selectedId={activeId} onSelect={setSelectedId} />
          </Error_Boundary>
        </section>
      )}

      {averages && (
        <div ref={detailRef} className='Health_anchor'>
          <Skin_Day_Detail dayId={activeId} />
        </div>
      )}

      {averages && (
        <Skin_Days_Panel
          temperatureDays={temperatureDays}
          selectedId={activeId}
          onSelect={openDay}
          onSeeAll={() => setAllOpen(true)}
        />
      )}

      {allOpen && <Skin_All_Days_Modal selectedId={activeId} onSelect={openDay} onClose={() => setAllOpen(false)} />}
    </div>
  );
};

export default Skin;
