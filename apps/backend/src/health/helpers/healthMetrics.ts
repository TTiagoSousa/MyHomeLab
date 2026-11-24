/** A composição corporal que vem com cada pesagem (cada uma tem a sua página). */
export const COMPOSITION_FIELDS = [
  'bodyFatPct',
  'subcutaneousFatPct',
  'visceralFat',
  'muscleKg',
  'skeletalMusclePct',
  'boneKg',
  'leanKg',
  'bmrKcal',
  'waterPct',
  'proteinPct',
] as const;

/** As medidas de fita do Corpo (uma linha por dia). */
export const BODY_FIELDS = [
  'waistCm',
  'chestCm',
  'armCm',
  'thighCm',
  'hipsCm',
  'neckCm',
] as const;

export type CompositionField = (typeof COMPOSITION_FIELDS)[number];
export type BodyField = (typeof BODY_FIELDS)[number];
export type HealthMetric = CompositionField | BodyField;

/** As métricas com página própria em Saúde → /metrics/:metric. */
export const HEALTH_METRICS: HealthMetric[] = [
  ...COMPOSITION_FIELDS,
  ...BODY_FIELDS,
];

/** O que um formulário rápido pode pedir. */
export const HEALTH_FORM_FIELDS = [
  'weightKg',
  ...COMPOSITION_FIELDS,
  ...BODY_FIELDS,
  'waterMl',
] as const;

export type HealthFormField = (typeof HEALTH_FORM_FIELDS)[number];

/** Os limites de cada valor (iguais no registo do Peso, do Corpo e nos formulários). */
export const FIELD_LIMITS: Record<
  HealthFormField,
  { min: number; max: number; decimals: number }
> = {
  weightKg: { min: 20, max: 400, decimals: 2 },
  bodyFatPct: { min: 1, max: 75, decimals: 1 },
  subcutaneousFatPct: { min: 1, max: 70, decimals: 1 },
  visceralFat: { min: 1, max: 60, decimals: 1 },
  muscleKg: { min: 5, max: 200, decimals: 2 },
  skeletalMusclePct: { min: 5, max: 80, decimals: 1 },
  boneKg: { min: 0.5, max: 15, decimals: 2 },
  leanKg: { min: 10, max: 300, decimals: 2 },
  bmrKcal: { min: 500, max: 6000, decimals: 0 },
  waterPct: { min: 20, max: 85, decimals: 1 },
  proteinPct: { min: 3, max: 40, decimals: 1 },
  waistCm: { min: 10, max: 300, decimals: 1 },
  chestCm: { min: 10, max: 300, decimals: 1 },
  armCm: { min: 5, max: 150, decimals: 1 },
  thighCm: { min: 10, max: 200, decimals: 1 },
  hipsCm: { min: 10, max: 300, decimals: 1 },
  neckCm: { min: 10, max: 100, decimals: 1 },
  waterMl: { min: 1, max: 5000, decimals: 0 },
};

export const isCompositionField = (field: string): field is CompositionField =>
  (COMPOSITION_FIELDS as readonly string[]).includes(field);

export const isBodyField = (field: string): field is BodyField =>
  (BODY_FIELDS as readonly string[]).includes(field);

/** Os separadores das médias em Saúde (os fixos mais uma por métrica). */
export const AVERAGE_TABS = [
  'sleep',
  'heart',
  'skin',
  'oxygen',
  'stress',
  'steps',
  'exercise',
  'weight',
  'water',
  ...HEALTH_METRICS,
];
