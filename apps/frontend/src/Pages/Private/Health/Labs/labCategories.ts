import type { LabResult } from '../../../../Hooks/Health/healthTypes';

export const LAB_CATEGORIES = [
  'hemogram',
  'white_cells',
  'glucose',
  'lipids',
  'kidney',
  'liver',
  'electrolytes',
  'thyroid',
  'vitamins',
  'inflammation',
  'hormones',
  'urine',
  'other',
];

const CATEGORY_KEYS: Record<string, string[]> = {
  hemogram: ['hemoglobin', 'red_blood_cells', 'hematocrit', 'mcv', 'mch', 'mchc', 'rdw', 'platelets', 'mpv', 'esr'],
  white_cells: ['white_blood_cells', 'neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils'],
  glucose: ['glucose', 'hba1c', 'insulin'],
  lipids: ['total_cholesterol', 'hdl_cholesterol', 'ldl_cholesterol', 'triglycerides'],
  kidney: ['creatinine', 'egfr', 'urea', 'uric_acid'],
  liver: ['ast', 'alt', 'ggt', 'alkaline_phosphatase', 'total_bilirubin', 'direct_bilirubin', 'total_protein', 'albumin'],
  electrolytes: ['sodium', 'potassium', 'chloride', 'calcium', 'magnesium', 'phosphorus'],
  thyroid: ['tsh', 'free_t4', 'free_t3'],
  vitamins: ['ferritin', 'iron', 'transferrin', 'vitamin_d', 'vitamin_b12', 'folate'],
  inflammation: ['crp'],
  hormones: ['psa', 'testosterone', 'cortisol'],
  urine: [
    'urine_color',
    'urine_appearance',
    'urine_ph',
    'urine_density',
    'urine_protein',
    'urine_glucose',
    'urine_ketones',
    'urine_hemoglobin',
    'urine_bilirubin',
    'urine_urobilinogen',
    'urine_nitrites',
    'urine_leukocytes',
    'urine_erythrocytes',
    'urine_epithelial_cells',
  ],
};

const CATEGORY_OF = new Map(
  Object.entries(CATEGORY_KEYS).flatMap(([category, keys]) => keys.map((key) => [key, category] as const)),
);

const ORDER_OF = new Map(Object.values(CATEGORY_KEYS).flat().map((key, index) => [key, index]));

const baseKey = (key: string) => key.replace(/_pct$/, '');

export const categoryOf = (key: string) => {
  if (key.startsWith('urine_')) return 'urine';
  return CATEGORY_OF.get(baseKey(key)) ?? 'other';
};

export interface LabItem<Result extends LabResult> {
  result: Result;
  percent: Result | null;
}

export const groupByCategory = <Result extends LabResult>(results: Result[]) => {
  const byKey = new Map(results.map((result) => [result.key, result]));
  const items: LabItem<Result>[] = [];
  for (const result of results) {
    if (result.key.endsWith('_pct') && byKey.has(baseKey(result.key))) continue;
    items.push({ result, percent: byKey.get(`${result.key}_pct`) ?? null });
  }

  return LAB_CATEGORIES.map((category) => ({
    category,
    items: items
      .filter((item) => categoryOf(item.result.key) === category)
      .sort((a, b) => (ORDER_OF.get(baseKey(a.result.key)) ?? 999) - (ORDER_OF.get(baseKey(b.result.key)) ?? 999)),
  })).filter((group) => group.items.length > 0);
};
