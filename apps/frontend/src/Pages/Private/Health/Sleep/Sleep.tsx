import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import { useSleepNights } from '../../../../Hooks/Health/useSleepNights';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { formatDay } from '../Shared/healthFormat';
import Sleep_Average_Tiles from './Sleep_Average_Tiles';
import Sleep_Trend_Chart from './Sleep_Trend_Chart';
import Sleep_Nights_Panel from './Sleep_Nights_Panel';
import Sleep_Night_Detail from './Sleep_Night_Detail';
import Sleep_All_Nights_Modal from './Sleep_All_Nights_Modal';

const Sleep = () => {
  const { t } = useTranslation('health');
  const detailRef = useRef<HTMLDivElement>(null);
  const [days, setDays] = useState(30);
  const [showNaps, setShowNaps] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const { averages, sessions, loading, error } = useSleepNights(days);

  const visible = sessions.filter((session) => showNaps || !session.isNap);
  const activeId = selectedId ?? visible[0]?.id ?? null;

  const openNight = (id: string) => {
    setSelectedId(id);
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('sleep.title')} days={days} onDays={setDays} />

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
                  {t('averages.basedOn', {
                    count: averages.nights,
                    from: formatDay(averages.from, false),
                    to: formatDay(averages.to, false),
                  })}
                </p>
              )}
            </div>
          </div>
          <Sleep_Average_Tiles averages={averages} detailed />
        </section>
      )}

      {averages && averages.nights > 0 && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('sleep.trendTitle')}</span>
              <p className='Health_card_description'>{t('sleep.trendHint')}</p>
            </div>
          </div>
          <Error_Boundary>
            <Sleep_Trend_Chart sessions={sessions} selectedId={activeId} onSelect={setSelectedId} />
          </Error_Boundary>
        </section>
      )}

      {averages && (
        <div ref={detailRef} className='Health_anchor'>
          <Sleep_Night_Detail sessionId={activeId} />
        </div>
      )}

      {averages && (
        <Sleep_Nights_Panel
          sessions={visible}
          selectedId={activeId}
          showNaps={showNaps}
          onShowNaps={setShowNaps}
          onSelect={openNight}
          onSeeAll={() => setAllOpen(true)}
        />
      )}

      {allOpen && (
        <Sleep_All_Nights_Modal
          selectedId={activeId}
          showNaps={showNaps}
          onSelect={openNight}
          onClose={() => setAllOpen(false)}
        />
      )}
    </div>
  );
};

export default Sleep;
