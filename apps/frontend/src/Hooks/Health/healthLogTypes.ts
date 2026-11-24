export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

export interface Meal {
  id: string;
  at: string;
  day: string;
  timeZone: string | null;
  mealType: MealType;
  text: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  estimated: boolean;
  hasPhoto: boolean;
}

export interface MealPayload {
  at: string;
  timeZone: string;
  mealType: MealType;
  text: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  estimated: boolean;
}

export interface MealEstimate {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  items: { name: string; portion: string | null; kcal: number }[];
  note: string | null;
}

export interface NutritionDay {
  day: string;
  meals: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  caffeineMg: number;
  alcoholUnits: number;
}

export interface NutritionData {
  meals: Meal[];
  days: NutritionDay[];
  averages: {
    days: number;
    kcal: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    caffeineMg: number | null;
    alcoholUnits: number | null;
  };
}

export type PhotoPose = 'FRONT' | 'SIDE' | 'BACK';
export type VitalKind = 'BLOOD_PRESSURE' | 'GLUCOSE' | 'TEMPERATURE';
export type GlucoseContext = 'FASTING' | 'BEFORE_MEAL' | 'AFTER_MEAL' | 'RANDOM';

export interface BodyMeasurementFields {
  waistCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  hipsCm: number | null;
  neckCm: number | null;
}

export interface BodyMeasurement extends BodyMeasurementFields {
  id: string;
  day: string;
  notes: string | null;
}

export interface BodyMeasurementPayload extends BodyMeasurementFields {
  day: string;
  notes: string | null;
}

export interface ProgressPhoto {
  id: string;
  day: string;
  pose: PhotoPose;
  notes: string | null;
}

export interface VitalReading {
  id: string;
  at: string;
  day: string;
  timeZone: string | null;
  kind: VitalKind;
  value: number;
  value2: number | null;
  pulse: number | null;
  context: GlucoseContext | null;
  notes: string | null;
  device: string | null;
}

export interface VitalPayload {
  at: string;
  timeZone: string;
  kind: VitalKind;
  value: number;
  value2: number | null;
  pulse: number | null;
  context: GlucoseContext | null;
  notes: string | null;
  deviceId: string | null;
}

export interface BodyData {
  measurements: BodyMeasurement[];
  photos: ProgressPhoto[];
  vitals: VitalReading[];
}

export interface MoodEntry {
  day: string;
  mood: number;
  energy: number;
  motivation: number;
  note: string | null;
}

export interface MoodPayload {
  mood: number;
  energy: number;
  motivation: number;
  note: string | null;
}

export interface Fast {
  id: string;
  startAt: string;
  endAt: string | null;
  targetHours: number;
  notes: string | null;
  hours: number | null;
}

export interface FastPayload {
  startAt: string;
  endAt: string | null;
  targetHours: number;
  notes: string | null;
}

export interface WellbeingData {
  moods: MoodEntry[];
  fasts: Fast[];
}
