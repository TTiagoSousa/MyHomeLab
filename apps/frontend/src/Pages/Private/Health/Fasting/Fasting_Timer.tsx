import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Fast } from '../../../../Hooks/Health/healthLogTypes';
import Health_Split_Bar from '../Shared/Health_Split_Bar';
import { formatDuration } from '../Shared/healthFormat';
import { fastEnd, formatClock, formatMoment } from './fastingFormat';

interface Fasting_Timer_Props {
  fast: Fast;
  saving: boolean;
  onFinish: () => void;
}

const Fasting_Timer = ({ fast, saving, onFinish }: Fasting_Timer_Props) => {
  const { t } = useTranslation('health');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsedMs = Math.max(0, now - new Date(fast.startAt).getTime());
  const elapsedMinutes = elapsedMs / 60_000;
  const targetMinutes = fast.targetHours * 60;
  const reached = elapsedMinutes >= targetMinutes;
  const done = Math.min(elapsedMinutes, targetMinutes);

  return (
    <div className='Fasting_Timer'>
      <div className='Fasting_Timer_Head'>
        <div className='Fasting_Elapsed'>
          <em>{formatClock(elapsedMs)}</em>
          <small>
            {reached ? t('fasting.now.reached') : t('fasting.now.left', { value: formatDuration(targetMinutes - elapsedMinutes) })}
          </small>
        </div>
        <div className='Fasting_Meta'>
          <span>{t('fasting.now.startedAt', { value: formatMoment(new Date(fast.startAt)) })}</span>
          <span>{t('fasting.now.expectedEnd', { value: formatMoment(fastEnd(fast)) })}</span>
          <span>{t('fasting.targetOf', { value: fast.targetHours })}</span>
        </div>
        <button type='button' className='Health_Form_Save' disabled={saving} onClick={onFinish}>
          {t('fasting.now.finish')}
        </button>
      </div>

      <Health_Split_Bar
        parts={[
          { key: 'done', label: t('fasting.now.elapsed'), value: done, className: reached ? 'fasting-goal' : 'fasting-done' },
          { key: 'left', label: t('fasting.now.remaining'), value: targetMinutes - done, className: 'fasting-left' },
        ]}
      />
      {fast.notes && <p className='Health_Notes'>{fast.notes}</p>}
    </div>
  );
};

export default Fasting_Timer;
