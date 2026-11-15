import { useTranslation } from 'react-i18next';
import type { IntakeDay, IntakeSettings } from '../../../../Hooks/Health/intakesTypes';
import Health_Stat from '../Shared/Health_Stat';
import Intakes_Limit_Bar from './Intakes_Limit_Bar';
import { formatDrinks, formatNumber } from './intakesFormat';

interface Intakes_Today_Card_Props {
  today: IntakeDay | null;
  weekDrinks: number;
  settings: IntakeSettings;
}

const Intakes_Today_Card = ({ today, weekDrinks, settings }: Intakes_Today_Card_Props) => {
  const { t } = useTranslation('health');
  const caffeine = today?.caffeineMg ?? 0;
  const caffeineOver = settings.caffeineLimitMg > 0 && caffeine > settings.caffeineLimitMg;
  const alcoholOver = settings.alcoholLimitWeek > 0 && weekDrinks > settings.alcoholLimitWeek;

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('intakes.today.title')}</span>
          <p className='Health_card_description'>{t('intakes.today.description')}</p>
        </div>
      </div>

      <div className='Health_Stats columns-3'>
        <Health_Stat
          highlight
          label={t('intakes.today.caffeine')}
          value={`${formatNumber(caffeine, 0)} mg`}
          sub={t('intakes.today.coffees', { count: today?.coffees ?? 0 })}
        />
        <Health_Stat label={t('intakes.today.drinks')} value={formatDrinks(t, today?.drinks ?? 0)} sub={`${formatNumber(today?.alcoholG ?? 0)} g`} />
        <Health_Stat
          label={t('intakes.today.week')}
          value={formatDrinks(t, weekDrinks)}
          sub={t('intakes.today.ofLimit', { value: formatNumber(settings.alcoholLimitWeek) })}
        />
      </div>

      {settings.caffeineLimitMg > 0 && (
        <Intakes_Limit_Bar
          label={t('intakes.today.caffeineBar', { value: formatNumber(caffeine, 0), limit: formatNumber(settings.caffeineLimitMg, 0) })}
          value={caffeine}
          limit={settings.caffeineLimitMg}
          className='intakes-caffeine'
        />
      )}
      {settings.alcoholLimitWeek > 0 && (
        <Intakes_Limit_Bar
          label={t('intakes.today.alcoholBar', { value: formatNumber(weekDrinks), limit: formatNumber(settings.alcoholLimitWeek) })}
          value={weekDrinks}
          limit={settings.alcoholLimitWeek}
          className='intakes-alcohol'
        />
      )}

      {caffeineOver && <p className='Intakes_Warning'>{t('intakes.today.caffeineOver', { value: formatNumber(caffeine - settings.caffeineLimitMg, 0) })}</p>}
      {alcoholOver && <p className='Intakes_Warning'>{t('intakes.today.alcoholOver', { value: formatNumber(weekDrinks - settings.alcoholLimitWeek) })}</p>}
    </section>
  );
};

export default Intakes_Today_Card;
