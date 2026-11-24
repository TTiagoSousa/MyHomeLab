import type { HealthMetric, HealthSummary } from '../../../Hooks/Health/healthTypes';
import { COMPOSITION_METRICS, HEALTH_METRICS, TAPE_METRICS } from './Metrics/metricCatalog';

export type BaseTab = 'sleep' | 'heart' | 'skin' | 'oxygen' | 'stress' | 'steps' | 'exercise' | 'weight' | 'water';
export type AverageTab = BaseTab | HealthMetric;

export const BASE_TABS: BaseTab[] = ['sleep', 'heart', 'skin', 'oxygen', 'stress', 'steps', 'exercise', 'weight', 'water'];

export const TAB_GROUPS: { key: 'general' | 'composition' | 'tape'; tabs: AverageTab[] }[] = [
  { key: 'general', tabs: BASE_TABS },
  { key: 'composition', tabs: COMPOSITION_METRICS },
  { key: 'tape', tabs: TAPE_METRICS },
];

export const ALL_TABS: AverageTab[] = [...BASE_TABS, ...HEALTH_METRICS];

export const tabsWithData = (summary: HealthSummary): HealthMetric[] =>
  HEALTH_METRICS.filter((metric) => summary.metrics?.[metric]);

export const tabLabelKey = (tab: AverageTab) =>
  (HEALTH_METRICS as string[]).includes(tab) ? `bodyMetrics.names.${tab}` : `tabs.${tab}`;
