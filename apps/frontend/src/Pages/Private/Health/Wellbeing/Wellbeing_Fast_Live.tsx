import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Fast } from '../../../../Hooks/Health/healthLogTypes';
import Health_Split_Bar from '../Shared/Health_Split_Bar';
import { formatClock } from '../Fasting/fastingFormat';

interface Wellbeing_Fast_Live_Props {
  fast: Fast;
}

const Wellbeing_Fast_Live = ({ fast }: Wellbeing_Fast_Live_Props) => {
  const { t } = useTranslation('health');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsedMs = Math.max(0, now - new Date(fast.startAt).getTime());
  const targetMs = fast.targetHours * 3_600_000;
  const done = Math.min(elapsedMs, targetMs);
  const reached = elapsedMs >= targetMs;

  return (
    <span className='Wellbeing_Fast_Live'>
      <span className='Wellbeing_Fast_Live_Head'>
        <small>{t('wellbeing.fasting.running')}</small>
        <em>{formatClock(elapsedMs)}</em>
        <small>{reached ? t('fasting.now.reached') : t('fasting.targetOf', { value: fast.targetHours })}</small>
      </span>
      <Health_Split_Bar
        parts={[
          { key: 'done', label: t('fasting.now.elapsed'), value: done, className: reached ? 'fasting-goal' : 'fasting-done' },
          { key: 'left', label: t('fasting.now.remaining'), value: targetMs - done, className: 'fasting-left' },
        ]}
      />
    </span>
  );
};

export default Wellbeing_Fast_Live;
