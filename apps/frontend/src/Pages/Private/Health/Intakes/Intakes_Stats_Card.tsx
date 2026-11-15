import { useTranslation } from 'react-i18next';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import type { IntakesData } from '../../../../Hooks/Health/intakesTypes';
import Health_Stat from '../Shared/Health_Stat';
import Intakes_Chart from './Intakes_Chart';
import { formatDrinks, formatNumber } from './intakesFormat';

interface Intakes_Stats_Card_Props {
  data: IntakesData;
  days: number;
}

const Intakes_Stats_Card = ({ data, days }: Intakes_Stats_Card_Props) => {
  const { t } = useTranslation('health');
  const { averages } = data;

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('averages.title')}</span>
          <p className='Health_card_description'>{days ? t('intakes.stats.description', { count: days }) : t('intakes.stats.descriptionAll')}</p>
        </div>
      </div>

      <div className='Health_Stats columns-4'>
        <Health_Stat
          highlight
          label={t('intakes.stats.caffeine')}
          value={averages.caffeineMg == null ? '—' : `${formatNumber(averages.caffeineMg, 0)} mg`}
          sub={averages.caffeineDays == null ? undefined : t('intakes.stats.caffeineDays', { value: formatNumber(averages.caffeineDays, 0) })}
        />
        <Health_Stat label={t('intakes.stats.coffees')} value={averages.coffees == null ? '—' : formatNumber(averages.coffees)} />
        <Health_Stat label={t('intakes.stats.drinksPerWeek')} value={averages.drinksPerWeek == null ? '—' : formatDrinks(t, averages.drinksPerWeek)} />
        <Health_Stat
          label={t('intakes.stats.alcoholFree')}
          value={averages.alcoholFreeDays == null ? '—' : String(averages.alcoholFreeDays)}
          sub={days && averages.alcoholFreeDays != null ? t('intakes.stats.ofDays', { count: days }) : undefined}
        />
      </div>

      <Error_Boundary>
        <Intakes_Chart intakeDays={data.days} />
      </Error_Boundary>
    </section>
  );
};

export default Intakes_Stats_Card;
