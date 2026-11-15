import type { ConditionSeverity, ConditionStatus } from '../../../../Hooks/Health/healthTypes';

export const CONDITION_STATUSES: ConditionStatus[] = ['ACTIVE', 'TREATING', 'CONTROLLED', 'RESOLVED'];

export const CONDITION_SEVERITIES: ConditionSeverity[] = ['MILD', 'MODERATE', 'SEVERE'];
