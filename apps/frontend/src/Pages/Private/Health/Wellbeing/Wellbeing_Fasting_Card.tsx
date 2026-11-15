import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import { useChartColors } from '../../../../Components/Charts/EChart/useChartColors';
import type { Fast, FastPayload } from '../../../../Hooks/Health/healthLogTypes';
import {
  FAST_REACHED_COLOR,
  fastReached,
  fastStats,
  finishPayload,
  formatHours,
  startPayload,
} from '../Fasting/fastingFormat';
import Wellbeing_Fast_Live from './Wellbeing_Fast_Live';
import Wellbeing_Metric from './Wellbeing_Metric';
import Wellbeing_Sparkline from './Wellbeing_Sparkline';
import { changeOf } from './wellbeingFormat';

const FASTING_PATH = '/MyHomeLab/Health/Fasting';

interface Wellbeing_Fasting_Card_Props {
  fasts: Fast[];
  previous: Fast[];
  open: Fast | null;
  defaultTarget: number;
  days: number;
  saving: boolean;
  onSave: (payload: FastPayload, id?: string) => Promise<string | null>;
}

const Wellbeing_Fasting_Card = ({ fasts, previous, open, defaultTarget, days, saving, onSave }: Wellbeing_Fasting_Card_Props) => {
  const { t } = useTranslation('health');
  const navigate = useNavigate();
  const colors = useChartColors();
  const [error, setError] = useState('');
  const stats = fastStats(fasts);
  const finished = fasts.filter((fast) => fast.hours != null).reverse();

  const handleAction = async () => {
    const failure = open ? await onSave(finishPayload(open), open.id) : await onSave(startPayload(defaultTarget));
    setError(failure ?? '');
  };

  return (
    <section className='Health_card Wellbeing_Card'>
      <button type='button' className='Wellbeing_Card_Body' onClick={() => navigate(FASTING_PATH)}>
        <span className='Wellbeing_Card_Head'>
          <span className='Health_card_title'>{t('wellbeing.fasting.title')}</span>
          <span className='Wellbeing_Card_Open'>{t('wellbeing.open')} →</span>
        </span>
        <span className='Health_card_description'>{t('wellbeing.fasting.description', { period: t(`periods.${days}`) })}</span>

        {open && <Wellbeing_Fast_Live fast={open} />}

        {!stats.count ? (
          <span className='Health_chart_empty'>{t('wellbeing.fasting.empty')}</span>
        ) : (
          <>
            <span className='Wellbeing_Metrics'>
              <Wellbeing_Metric label={t('fasting.stats.count')} value={String(stats.count)} />
              <Wellbeing_Metric
                label={t('fasting.stats.average')}
                value={formatHours(stats.averageHours)}
                change={changeOf(stats.averageHours, fastStats(previous).averageHours)}
                unit=' h'
              />
              <Wellbeing_Metric
                label={t('fasting.stats.success')}
                value={stats.successRate == null ? '—' : `${stats.successRate}%`}
                sub={t('fasting.stats.successSub', { done: stats.reached, total: stats.count })}
              />
              <Wellbeing_Metric label={t('fasting.stats.longest')} value={formatHours(stats.longest)} />
            </span>
            <Error_Boundary>
              <Wellbeing_Sparkline
                kind='bar'
                values={finished.map((fast) => fast.hours ?? 0)}
                colors={finished.map((fast) => (fastReached(fast) ? FAST_REACHED_COLOR : colors.accent))}
                min={0}
              />
            </Error_Boundary>
          </>
        )}
      </button>

      <div className='Wellbeing_Card_Actions'>
        <span className='Wellbeing_Today'>
          {open ? t('fasting.targetOf', { value: open.targetHours }) : t('wellbeing.fasting.idle')}
        </span>
        <button type='button' className='Health_Form_Save' disabled={saving} onClick={() => void handleAction()}>
          {open ? t('fasting.now.finish') : t('wellbeing.fasting.start', { value: defaultTarget })}
        </button>
      </div>
      {error && <p className='Health_Form_Error'>{error}</p>}
    </section>
  );
};

export default Wellbeing_Fasting_Card;
