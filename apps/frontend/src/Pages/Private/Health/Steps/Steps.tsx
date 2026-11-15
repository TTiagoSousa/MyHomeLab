import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import { useSteps } from '../../../../Hooks/Health/useSteps';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { formatDay } from '../Shared/healthFormat';
import Steps_Average_Tiles from './Steps_Average_Tiles';
import Steps_Trend_Chart from './Steps_Trend_Chart';
import Steps_Day_Detail from './Steps_Day_Detail';
import Steps_Days_Panel from './Steps_Days_Panel';
import Steps_All_Days_Modal from './Steps_All_Days_Modal';

const Steps = () => {
  const { t } = useTranslation('health');
  const detailRef = useRef<HTMLDivElement>(null);
  const [days, setDays] = useState(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const { averages, stepsDays, loading, error } = useSteps(days);

  const activeId = selectedId ?? stepsDays[0]?.id ?? null;

  const openDay = (id: string) => {
    setSelectedId(id);
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('steps.title')} days={days} onDays={setDays} />

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
          <Steps_Average_Tiles averages={averages} detailed />
        </section>
      )}

      {averages && averages.days > 0 && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('steps.trendTitle')}</span>
              <p className='Health_card_description'>{t('steps.trendHint')}</p>
            </div>
          </div>
          <Error_Boundary>
            <Steps_Trend_Chart stepsDays={stepsDays} selectedId={activeId} onSelect={setSelectedId} />
          </Error_Boundary>
        </section>
      )}

      {averages && (
        <div ref={detailRef} className='Health_anchor'>
          <Steps_Day_Detail dayId={activeId} />
        </div>
      )}

      {averages && (
        <Steps_Days_Panel
          stepsDays={stepsDays}
          selectedId={activeId}
          onSelect={openDay}
          onSeeAll={() => setAllOpen(true)}
        />
      )}

      {allOpen && <Steps_All_Days_Modal selectedId={activeId} onSelect={openDay} onClose={() => setAllOpen(false)} />}
    </div>
  );
};

export default Steps;
