import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { HealthSummary } from '../../../Hooks/Health/healthTypes';
import Sleep_Average_Tiles from './Sleep/Sleep_Average_Tiles';
import Heart_Average_Tiles from './Heart/Heart_Average_Tiles';
import Skin_Average_Tiles from './Skin/Skin_Average_Tiles';
import Oxygen_Average_Tiles from './Oxygen/Oxygen_Average_Tiles';
import Stress_Average_Tiles from './Stress/Stress_Average_Tiles';
import Exercise_Average_Tiles from './Exercise/Exercise_Average_Tiles';
import Steps_Average_Tiles from './Steps/Steps_Average_Tiles';
import Weight_Average_Tiles from './Weight/Weight_Average_Tiles';
import Water_Average_Tiles from './Water/Water_Average_Tiles';
import { formatDay } from './Shared/healthFormat';
import Metric_Average_Tiles from './Metrics/Metric_Average_Tiles';
import { isHealthMetric, metricPath } from './Metrics/metricCatalog';
import Health_Average_Tabs from './Health_Average_Tabs';
import Health_Recent_Values from './Health_Recent_Values';
import { formatKg } from './Weight/weightFormat';
import { formatMl } from './Water/waterFormat';
import { formatField } from './Metrics/metricCatalog';
import { BASE_TABS, tabsWithData, type AverageTab } from './averageTabs';

type Period = 'last7' | 'last30' | 'last90';

const MANUAL_TABS: Partial<Record<AverageTab, { path: string; action: string }>> = {
  weight: { path: '/MyHomeLab/Health/Weight', action: 'averages.openWeight' },
  water: { path: '/MyHomeLab/Health/Water', action: 'averages.openWater' },
};

interface Health_Averages_Card_Props {
  summary: HealthSummary;
  savedTabs: string[];
  savingTabs: boolean;
  onSaveTabs: (tabs: AverageTab[]) => Promise<string | null>;
}

const Health_Averages_Card = ({ summary, savedTabs, savingTabs, onSaveTabs }: Health_Averages_Card_Props) => {
  const { t } = useTranslation('health');
  const navigate = useNavigate();
  const visibleTabs = savedTabs.length ? (savedTabs as AverageTab[]) : [...BASE_TABS, ...tabsWithData(summary)];
  const withData: [AverageTab, unknown][] = [
    ['sleep', summary.sleep],
    ['heart', summary.heart],
    ['skin', summary.skinTemperature],
    ['oxygen', summary.bloodOxygen],
    ['stress', summary.stress],
    ['steps', summary.steps],
    ['exercise', summary.exercise],
    ['weight', summary.weight],
    ['water', summary.water],
  ];
  const firstTab = withData.find(([key, data]) => data && visibleTabs.includes(key))?.[0] ?? visibleTabs[0] ?? 'sleep';
  const [chosenTab, setChosenTab] = useState<AverageTab>(firstTab);
  const tab = visibleTabs.includes(chosenTab) ? chosenTab : (visibleTabs[0] ?? 'sleep');
  const [period, setPeriod] = useState<Period>('last7');

  const sleep = summary.sleep;
  const heart = summary.heart;
  const skin = summary.skinTemperature;
  const oxygen = summary.bloodOxygen;
  const stress = summary.stress;
  const steps = summary.steps;
  const exercise = summary.exercise;
  const weight = summary.weight;
  const water = summary.water;
  const range = (from: string | null, to: string | null) => ({
    from: from ? formatDay(from, false) : '—',
    to: to ? formatDay(to, false) : '—',
  });

  const content = () => {
    if (isHealthMetric(tab)) {
      const metricSummary = summary.metrics[tab];
      if (!metricSummary) return null;
      const averages = metricSummary[period];
      return {
        title: t(`bodyMetrics.names.${tab}`),
        description: t('bodyMetrics.basedOn', { count: averages.entries, ...range(averages.from, averages.to) }),
        body: <Metric_Average_Tiles metric={tab} averages={averages} />,
        recent: metricSummary.recent.map((item) => ({ day: item.day, text: formatField(tab, item.value) })),
        latest: t('averages.latestDay', { date: formatDay(metricSummary.latestDay) }),
        more: t('bodyMetrics.seeMore'),
        path: metricPath(tab),
      };
    }
    if (tab === 'sleep' && sleep) {
      const averages = sleep[period];
      return {
        title: t('averages.sleepTitle'),
        description: t('averages.basedOn', { count: averages.nights, ...range(averages.from, averages.to) }),
        body: <Sleep_Average_Tiles averages={averages} />,
        latest: t('averages.latestNight', { date: formatDay(sleep.latestNight.night) }),
        more: t('averages.seeMoreSleep'),
        path: '/MyHomeLab/Health/Sleep',
      };
    }
    if (tab === 'heart' && heart) {
      const averages = heart[period];
      return {
        title: t('averages.heartTitle'),
        description: t('averages.daysBasedOn', { count: averages.days, ...range(averages.from, averages.to) }),
        body: <Heart_Average_Tiles averages={averages} />,
        latest: t('averages.latestDay', { date: formatDay(heart.latestDay.day) }),
        more: t('averages.seeMoreHeart'),
        path: '/MyHomeLab/Health/Heart',
      };
    }
    if (tab === 'skin' && skin) {
      const averages = skin[period];
      return {
        title: t('averages.skinTitle'),
        description: t('averages.daysBasedOn', { count: averages.days, ...range(averages.from, averages.to) }),
        body: <Skin_Average_Tiles averages={averages} />,
        latest: t('averages.latestDay', { date: formatDay(skin.latestDay.day) }),
        more: t('averages.seeMoreSkin'),
        path: '/MyHomeLab/Health/Skin',
      };
    }
    if (tab === 'oxygen' && oxygen) {
      const averages = oxygen[period];
      return {
        title: t('averages.oxygenTitle'),
        description: t('averages.daysBasedOn', { count: averages.days, ...range(averages.from, averages.to) }),
        body: <Oxygen_Average_Tiles averages={averages} />,
        latest: t('averages.latestDay', { date: formatDay(oxygen.latestDay.day) }),
        more: t('averages.seeMoreOxygen'),
        path: '/MyHomeLab/Health/Oxygen',
      };
    }
    if (tab === 'stress' && stress) {
      const averages = stress[period];
      return {
        title: t('averages.stressTitle'),
        description: t('averages.daysBasedOn', { count: averages.days, ...range(averages.from, averages.to) }),
        body: <Stress_Average_Tiles averages={averages} />,
        latest: t('averages.latestDay', { date: formatDay(stress.latestDay.day) }),
        more: t('averages.seeMoreStress'),
        path: '/MyHomeLab/Health/Stress',
      };
    }
    if (tab === 'steps' && steps) {
      const averages = steps[period];
      return {
        title: t('averages.stepsTitle'),
        description: t('averages.daysBasedOn', { count: averages.days, ...range(averages.from, averages.to) }),
        body: <Steps_Average_Tiles averages={averages} />,
        latest: t('averages.latestDay', { date: formatDay(steps.latestDay.day) }),
        more: t('averages.seeMoreSteps'),
        path: '/MyHomeLab/Health/Steps',
      };
    }
    if (tab === 'exercise' && exercise) {
      const averages = exercise[period];
      return {
        title: t('averages.exerciseTitle'),
        description: t('exercise.basedOn', { count: averages.workouts, ...range(averages.from, averages.to) }),
        body: <Exercise_Average_Tiles averages={averages} />,
        latest: t('averages.latestDay', { date: formatDay(exercise.latestDay) }),
        more: t('averages.seeMoreExercise'),
        path: '/MyHomeLab/Health/Exercise',
      };
    }
    if (tab === 'weight' && weight) {
      const averages = weight[period];
      return {
        title: t('averages.weightTitle'),
        description: t('averages.weighingsBasedOn', { count: averages.entries, ...range(averages.from, averages.to) }),
        body: <Weight_Average_Tiles averages={averages} />,
        recent: weight.recent.map((item) => ({ day: item.day, text: formatKg(item.value) })),
        latest: t('averages.latestWeight', { date: formatDay(weight.latestDay) }),
        more: t('averages.seeMoreWeight'),
        path: '/MyHomeLab/Health/Weight',
      };
    }
    if (tab === 'water' && water) {
      const averages = water[period];
      return {
        title: t('averages.waterTitle'),
        description: t('averages.daysBasedOn', { count: averages.days, ...range(averages.from, averages.to) }),
        body: <Water_Average_Tiles averages={averages} />,
        recent: water.recent.map((item) => ({ day: item.day, text: formatMl(item.value) })),
        latest: t('averages.latestWater', { date: formatDay(water.latestDay) }),
        more: t('averages.seeMoreWater'),
        path: '/MyHomeLab/Health/Water',
      };
    }
    return null;
  };

  const current = content();

  return (
    <section className='Health_Averages'>
      <Health_Average_Tabs tabs={visibleTabs} active={tab} saving={savingTabs} onSelect={setChosenTab} onSave={onSaveTabs} />

      <div className='Health_Averages_Body'>
        {!current && (
          <span className='Health_Averages_Sub Health_Averages_Empty'>
            {isHealthMetric(tab) ? t('bodyMetrics.emptyTab', { name: t(`bodyMetrics.names.${tab}`) }) : t(`averages.empty.${tab}`)}
          </span>
        )}

        {!current && isHealthMetric(tab) && (
          <div className='Health_Averages_Footer'>
            <span />
            <button type='button' onClick={() => navigate(metricPath(tab))}>
              {t('bodyMetrics.register', { name: t(`bodyMetrics.names.${tab}`) })}
            </button>
          </div>
        )}

        {!current && MANUAL_TABS[tab] && (
          <div className='Health_Averages_Footer'>
            <span />
            <button type='button' onClick={() => navigate(MANUAL_TABS[tab]!.path)}>
              {t(MANUAL_TABS[tab]!.action)}
            </button>
          </div>
        )}

        {current && (
          <>
            <div className='Health_Averages_Head'>
              <div>
                <span className='Health_Averages_Title'>{current.title}</span>
                <span className='Health_Averages_Sub'>{current.description}</span>
              </div>

              <div className='Health_Averages_Periods'>
                {(['last7', 'last30', 'last90'] as const).map((option) => (
                  <button
                    key={option}
                    type='button'
                    className={option === period ? 'active' : ''}
                    onClick={() => setPeriod(option)}
                  >
                    {t(`averages.${option}`)}
                  </button>
                ))}
              </div>
            </div>

            {current.body}

            {'recent' in current && current.recent && current.recent.length > 0 && <Health_Recent_Values items={current.recent} />}

            <div className='Health_Averages_Footer'>
              <span>{current.latest}</span>
              <button type='button' onClick={() => navigate(current.path)}>
                {current.more}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default Health_Averages_Card;
