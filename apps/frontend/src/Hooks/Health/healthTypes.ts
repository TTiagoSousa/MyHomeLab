import type { RunFrequency } from '@myhomelab/shared';

export type SleepStage = 'DEEP' | 'LIGHT' | 'REM' | 'AWAKE' | 'NAP';

export interface SleepStageSegment {
  stage: SleepStage;
  start: string;
  minutes: number;
}

export interface SleepAverages {
  nights: number;
  from: string | null;
  to: string | null;
  asleepMin: number | null;
  deepPct: number | null;
  lightPct: number | null;
  remPct: number | null;
  awakeMin: number | null;
  latencyMin: number | null;
  efficiency: number | null;
  bedtime: string | null;
  wakeTime: string | null;
  avgHeartRate: number | null;
  avgHrv: number | null;
  avgSpo2: number | null;
  avgBreathRate: number | null;
  naps: { count: number; avgMin: number | null };
}

export interface SleepSession {
  id: string;
  source: string;
  isNap: boolean;
  night: string;
  timeZone: string | null;
  bedAt: string | null;
  asleepAt: string;
  wakeAt: string;
  riseAt: string | null;
  asleepMin: number;
  deepMin: number;
  lightMin: number;
  remMin: number;
  awakeMin: number;
  efficiency: number | null;
  latencyMin: number | null;
  deepContinuity: number | null;
  wakeCount: number | null;
  turnOverCount: number | null;
  snoreFreq: number | null;
  rdi: number | null;
  avgHeartRate: number | null;
  minHeartRate: number | null;
  maxHeartRate: number | null;
  avgHrv: number | null;
  avgBreathRate: number | null;
  avgSpo2: number | null;
  minSpo2: number | null;
}

export interface SleepSessionDetail extends SleepSession {
  stages: SleepStageSegment[];
}

export interface HeartZones {
  low: number;
  normal: number;
  elevated: number;
  high: number;
}

export interface HeartAverages {
  days: number;
  from: string | null;
  to: string | null;
  restingBpm: number | null;
  restingMin: number | null;
  restingMax: number | null;
  avgBpm: number | null;
  minBpm: number | null;
  minDay: string | null;
  maxBpm: number | null;
  maxDay: string | null;
  avgHrv: number | null;
  samplesPerDay: number | null;
  zones: HeartZones;
}

export interface HeartDay {
  id: string;
  source: string;
  day: string;
  timeZone: string | null;
  avgBpm: number;
  minBpm: number;
  maxBpm: number;
  minAt: number | null;
  maxAt: number | null;
  restingBpm: number | null;
  avgHrv: number | null;
  samples: number;
  zones: HeartZones;
}

export interface HeartDayDetail extends HeartDay {
  points: [number, number][];
  hrvPoints: [number, number][] | null;
}

export interface HealthSummary {
  metrics: Record<HealthMetric, MetricSummary | null>;
  sleep: {
    latestNight: SleepSessionDetail;
    last7: SleepAverages;
    last30: SleepAverages;
    last90: SleepAverages;
  } | null;
  heart: {
    latestDay: HeartDay;
    last7: HeartAverages;
    last30: HeartAverages;
    last90: HeartAverages;
  } | null;
  skinTemperature: {
    latestDay: SkinTemperatureDay;
    last7: SkinTemperatureAverages;
    last30: SkinTemperatureAverages;
    last90: SkinTemperatureAverages;
  } | null;
  bloodOxygen: {
    latestDay: BloodOxygenDay;
    last7: BloodOxygenAverages;
    last30: BloodOxygenAverages;
    last90: BloodOxygenAverages;
  } | null;
  stress: {
    latestDay: StressDay;
    last7: StressAverages;
    last30: StressAverages;
    last90: StressAverages;
  } | null;
  steps: {
    latestDay: ActivityDay;
    last7: StepsAverages;
    last30: StepsAverages;
    last90: StepsAverages;
  } | null;
  exercise: {
    latestDay: string;
    last7: ExerciseAverages;
    last30: ExerciseAverages;
    last90: ExerciseAverages;
  } | null;
  weight: {
    latestDay: string;
    last7: WeightAverages;
    last30: WeightAverages;
    last90: WeightAverages;
    recent: RecentValue[];
  } | null;
  water: {
    latestDay: string;
    last7: WaterAverages;
    last30: WaterAverages;
    last90: WaterAverages;
    recent: RecentValue[];
  } | null;
}

export interface WeightAverages {
  entries: number;
  from: string | null;
  to: string | null;
  latestKg: number | null;
  latestDay: string | null;
  changeKg: number | null;
  avgKg: number | null;
  minKg: number | null;
  minDay: string | null;
  maxKg: number | null;
  maxDay: string | null;
}

export type CompositionField =
  | 'bmi'
  | 'bodyFatPct'
  | 'fatMassKg'
  | 'subcutaneousFatPct'
  | 'visceralFat'
  | 'musclePct'
  | 'muscleKg'
  | 'skeletalMusclePct'
  | 'skeletalMuscleKg'
  | 'bonePct'
  | 'boneKg'
  | 'leanKg'
  | 'bmrKcal'
  | 'waterPct'
  | 'waterKg'
  | 'proteinPct'
  | 'proteinKg';

export type TapeField = 'waistCm' | 'chestCm' | 'armCm' | 'thighCm' | 'hipsCm' | 'neckCm';

export type HealthMetric = CompositionField | TapeField;

export type HealthFormField = 'weightKg' | HealthMetric | 'waterMl';

export interface WeightEntry extends Record<CompositionField, number | null> {
  id: string;
  day: string;
  measuredAt: string;
  timeZone: string | null;
  device: string | null;
  weightKg: number | null;
  changeKg: number | null;
}

export interface MetricAverages {
  entries: number;
  from: string | null;
  to: string | null;
  latest: number | null;
  latestDay: string | null;
  change: number | null;
  avg: number | null;
  min: number | null;
  minDay: string | null;
  max: number | null;
  maxDay: string | null;
}

export interface MetricPoint {
  id: string;
  day: string;
  at: string;
  timeZone: string | null;
  device: string | null;
  value: number;
  change: number | null;
}

export interface RecentValue {
  day: string;
  value: number;
}

export interface MetricSummary {
  latestDay: string;
  last7: MetricAverages;
  last30: MetricAverages;
  last90: MetricAverages;
  recent: RecentValue[];
}

export type DeviceKind = 'SCALE' | 'BLOOD_PRESSURE' | 'GLUCOMETER' | 'THERMOMETER' | 'OXIMETER' | 'OTHER';

export interface MeasurementDevice {
  id: string;
  kind: DeviceKind;
  name: string;
  brand: string | null;
  model: string | null;
  notes: string | null;
  isDefault: boolean;
}

export type HealthFormLayout = 'GRID' | 'LIST';

export interface HealthForm {
  id: string;
  name: string;
  fields: HealthFormField[];
  layout: HealthFormLayout;
}

export interface WaterAverages {
  days: number;
  from: string | null;
  to: string | null;
  avgMl: number | null;
  goalMl: number;
  goalDays: number;
  bestDay: string | null;
  bestMl: number | null;
  totalMl: number;
}

export interface WaterEntry {
  id: string;
  drankAt: string;
  timeZone: string | null;
  ml: number;
}

export interface WaterDay {
  day: string;
  ml: number;
  entries: WaterEntry[];
}

export interface HuaweiImportResult {
  sessions: number;
  nights: number;
  naps: number;
  created: number;
  updated: number;
  from: string | null;
  to: string | null;
}

export interface HuaweiHeartImportResult {
  days: number;
  created: number;
  updated: number;
  from: string;
  to: string;
}

export type HeartReading = [number, number, string | null];

export interface HuaweiHeartPayload {
  heartRate: HeartReading[];
  resting: HeartReading[];
  hrv: HeartReading[];
}

export interface HuaweiSkinTemperaturePayload {
  skinTemperature: HeartReading[];
}

export interface HuaweiBloodOxygenPayload {
  bloodOxygen: HeartReading[];
}

export interface HuaweiStressPayload {
  stress: HeartReading[];
}

export interface HuaweiDetailReadings {
  heart: HuaweiHeartPayload;
  skinTemperature: HuaweiSkinTemperaturePayload;
  bloodOxygen: HuaweiBloodOxygenPayload;
  stress: HuaweiStressPayload;
}

export interface HuaweiSkinTemperatureImportResult {
  days: number;
  created: number;
  updated: number;
  from: string;
  to: string;
}

export interface SkinTemperatureRanges {
  cold: number;
  cool: number;
  normal: number;
  warm: number;
}

export interface SkinTemperatureAverages {
  days: number;
  from: string | null;
  to: string | null;
  avgTemp: number | null;
  nightAvg: number | null;
  minTemp: number | null;
  minDay: string | null;
  maxTemp: number | null;
  maxDay: string | null;
  avgSpread: number | null;
  samplesPerDay: number | null;
  ranges: SkinTemperatureRanges;
}

export interface SkinTemperatureDay {
  id: string;
  source: string;
  day: string;
  timeZone: string | null;
  avgTemp: number;
  minTemp: number;
  maxTemp: number;
  minAt: number | null;
  maxAt: number | null;
  nightAvg: number | null;
  samples: number;
  ranges: SkinTemperatureRanges;
}

export interface SkinTemperatureDayDetail extends SkinTemperatureDay {
  points: [number, number][];
}

export interface BloodOxygenRanges {
  low: number;
  reduced: number;
  normal: number;
  high: number;
}

export interface BloodOxygenAverages {
  days: number;
  from: string | null;
  to: string | null;
  avgSpo2: number | null;
  nightAvg: number | null;
  minSpo2: number | null;
  minDay: string | null;
  maxSpo2: number | null;
  samplesPerDay: number | null;
  ranges: BloodOxygenRanges;
}

export interface BloodOxygenDay {
  id: string;
  source: string;
  day: string;
  timeZone: string | null;
  avgSpo2: number;
  minSpo2: number;
  maxSpo2: number;
  minAt: number | null;
  maxAt: number | null;
  nightAvg: number | null;
  samples: number;
  ranges: BloodOxygenRanges;
}

export interface BloodOxygenDayDetail extends BloodOxygenDay {
  points: [number, number][];
}

export interface HuaweiBloodOxygenImportResult {
  days: number;
  created: number;
  updated: number;
  from: string;
  to: string;
}

export interface StressLevels {
  relaxed: number;
  normal: number;
  medium: number;
  high: number;
}

export interface StressAverages {
  days: number;
  from: string | null;
  to: string | null;
  avgScore: number | null;
  minScore: number | null;
  maxScore: number | null;
  maxDay: string | null;
  calmestDay: string | null;
  calmestAvg: number | null;
  samplesPerDay: number | null;
  levels: StressLevels;
}

export interface StressDay {
  id: string;
  source: string;
  day: string;
  timeZone: string | null;
  avgScore: number;
  minScore: number;
  maxScore: number;
  minAt: number | null;
  maxAt: number | null;
  samples: number;
  levels: StressLevels;
}

export interface StressDayDetail extends StressDay {
  points: [number, number][];
}

export interface HuaweiStressImportResult {
  days: number;
  created: number;
  updated: number;
  from: string;
  to: string;
}

export type ActivityMinute = [number, number, number, number, string | null];

export interface HuaweiWorkoutRecord {
  recordId: string;
  startTime: number;
  endTime: number;
  timeZone: string | null;
  summaryData: string;
  detail: string;
}

export interface HuaweiExercisePayload {
  activity: ActivityMinute[];
  workouts: HuaweiWorkoutRecord[];
}

export interface HuaweiStepsImportResult {
  days: number;
  created: number;
  updated: number;
  from: string;
  to: string;
}

export interface HuaweiExerciseImportResult {
  workouts: number;
  created: number;
  updated: number;
  from: string;
  to: string;
}

export interface StepsLevels {
  low: number;
  some: number;
  active: number;
  goal: number;
}

export interface StepsAverages {
  days: number;
  from: string | null;
  to: string | null;
  steps: number | null;
  distanceM: number | null;
  calories: number | null;
  activeMinutes: number | null;
  bestDay: string | null;
  bestSteps: number | null;
  goalDays: number;
  totalSteps: number;
  totalDistanceM: number;
  levels: StepsLevels;
}

export interface ActivityDay {
  id: string;
  source: string;
  day: string;
  timeZone: string | null;
  steps: number;
  distanceM: number;
  calories: number;
  activeMinutes: number;
}

export interface ActivityDayDetail extends ActivityDay {
  hourly: number[] | null;
}

export interface ExerciseAverages {
  workouts: number;
  from: string | null;
  to: string | null;
  perWeek: number | null;
  totalMinutes: number;
  avgMinutes: number | null;
  totalCalories: number;
  totalDistanceM: number;
  avgHeartRate: number | null;
  intenseMinutes: number;
  longestMinutes: number | null;
  longestType: string | null;
  longestDay: string | null;
  peakHeartRate: number | null;
  peakDay: string | null;
  workoutsByType: Record<string, number>;
}

export interface HeartZoneSeconds {
  easy: number;
  moderate: number;
  hard: number;
  peak: number;
}

export interface Workout {
  id: string;
  source: string;
  externalId: string;
  typeId: string;
  sportType: number | null;
  title: string | null;
  notes: string | null;
  day: string;
  timeZone: string | null;
  startAt: string;
  endAt: string;
  durationSec: number;
  distanceM: number | null;
  calories: number | null;
  steps: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  minHeartRate: number | null;
  avgPace: number | null;
  bestPace: number | null;
  avgCadence: number | null;
  ascentM: number | null;
  descentM: number | null;
  trainingEffect: number | null;
  recoveryMin: number | null;
  heartZones: HeartZoneSeconds | null;
  hasRoute: boolean;
  difficulty?: number | null;
  caloriesEstimated?: boolean;
  syncedAt?: string | null;
  volumeKg?: number | null;
  exerciseCount?: number;
  parentId?: string | null;
  partRole?: WorkoutPartRole | null;
}

export type WorkoutPartRole = 'WARMUP' | 'COOLDOWN' | 'PART';

export interface WorkoutPartPayload {
  id: string;
  role: WorkoutPartRole;
}

export interface WorkoutSessionTotals {
  startAt: string;
  endAt: string;
  durationSec: number;
  distanceM: number | null;
  calories: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
}

export interface WorkoutDetail extends Workout {
  heartRate: [number, number][] | null;
  cadence: [number, number][] | null;
  altitude: [number, number][] | null;
  route: [number, number][][] | null;
  splits: [number, number][] | null;
  exercises: WorkoutExerciseLog[];
  partExercises: { id: string; title: string | null; exercises: WorkoutExerciseLog[] }[];
  context: WorkoutContext;
  parent: { id: string; typeId: string; startAt: string; day: string } | null;
  parts: Workout[];
  session: WorkoutSessionTotals | null;
}

export interface WorkoutSetLog {
  warmup: boolean;
  reps: number | null;
  sec: number | null;
  weightKg: number | null;
  done: boolean;
  at: string | null;
  restSec: number | null;
  rir: number | null;
  rpe: number | null;
}

export interface WorkoutExerciseLog {
  id: string;
  name: string | null;
  bodyPart: string | null;
  target: string | null;
  equipment: string | null;
  mode: 'reps' | 'time';
  planned: { sets: number | null; reps: number | null; sec: number | null; weightKg: number | null } | null;
  sets: WorkoutSetLog[];
  record: boolean;
  topWeightKg: number | null;
}

export interface ExerciseTotal {
  id: string;
  name: string | null;
  workouts: number;
  sets: number;
  reps: number;
  seconds: number;
  maxWeightKg: number | null;
  records: number;
}

export interface ExerciseType {
  id: string;
  category: 'SPORT';
  huaweiCodes: number[];
  position: number;
}

export interface WorkoutSession {
  startAt: string;
  endAt?: string;
  timeZone: string;
  durationMin?: number;
  calories?: number;
  difficulty?: number;
  notes?: string;
}

export interface ManualWorkoutPayload extends WorkoutSession {
  typeId: string;
}

export interface WorkoutSync {
  heart: boolean;
  calories: boolean;
}

export interface WorkoutSaveResult {
  error: string | null;
  sync: WorkoutSync | null;
}

export interface OpenGymSyncResult {
  unchanged: boolean;
  created: number;
  updated: number;
  deleted: number;
  linked: number;
  heart: number;
}

export interface OpenGymStatus {
  online: boolean;
  error: string | null;
}

export interface OpenGymConnection {
  connected: boolean;
  baseUrl?: string;
  accountId?: string | null;
  appName?: string | null;
  accountName?: string | null;
  isActive?: boolean;
  runFrequency?: RunFrequency;
  lastRunAt?: string | null;
  lastSuccessAt?: string | null;
  lastError?: string | null;
  lastCreated?: number | null;
  lastUpdated?: number | null;
  lastDeleted?: number | null;
  workouts?: number;
  sync?: OpenGymSyncResult;
}

export interface WorkoutContextSummary {
  avg: number;
  min: number;
  max: number;
}

export interface WorkoutContext {
  restingBpm: number | null;
  skinTemperature: [number, number][] | null;
  bloodOxygen: [number, number][] | null;
  stress: [number, number][] | null;
  skinSummary: WorkoutContextSummary | null;
  oxygenSummary: WorkoutContextSummary | null;
  stressSummary: WorkoutContextSummary | null;
}

export type LabFlag = 'LOW' | 'HIGH' | 'ABNORMAL';

export interface LabResult {
  key: string;
  name: string;
  section: string | null;
  group: string | null;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  flag: LabFlag | null;
}

export interface LabReportSummary {
  id: string;
  collectedAt: string;
  lab: string | null;
  source: 'PDF' | 'MANUAL';
  notes: string | null;
  fileName: string | null;
  hasPdf: boolean;
  results: number;
  outOfRange: number;
}

export interface LabReport {
  id: string;
  collectedAt: string;
  lab: string | null;
  source: 'PDF' | 'MANUAL';
  notes: string | null;
  fileName: string | null;
  hasPdf: boolean;
  results: LabResult[];
}

export interface LabParameter extends LabResult {
  reportId: string;
  date: string;
  count: number;
  previousValue: number | null;
  previousDate: string | null;
}

export interface LabHistoryPoint extends LabResult {
  reportId: string;
  date: string;
  lab: string | null;
}

export interface LabDraft {
  lab: string | null;
  collectedAt: string | null;
  results: LabResult[];
}

export interface LabAnalyte {
  key: string;
  name: string;
}

export interface LabReportPayload {
  collectedAt: string;
  lab: string | null;
  source: 'PDF' | 'MANUAL';
  notes: string | null;
  results: Partial<LabResult>[];
}

export type Sex = 'MALE' | 'FEMALE' | 'OTHER';

export interface HealthProfileFields {
  fullName: string | null;
  birthDate: string | null;
  sex: Sex | null;
  bloodType: string | null;
  emergencyContact: string | null;
  notes: string | null;
  heightCm: number | null;
  averageTabs: string[];
}

export interface HealthProfile extends HealthProfileFields {
  age: number | null;
  weightKg: number | null;
  bmi: number | null;
}

export type MedicationKind = 'MEDICATION' | 'VITAMIN' | 'SUPPLEMENT';

export interface Medication {
  id: string;
  kind: MedicationKind;
  name: string;
  brand: string | null;
  substance: string | null;
  doseAmount: number | null;
  doseUnit: string | null;
  timesPerDay: number | null;
  times: string[];
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  active: boolean;
  condition: HealthConditionLink | null;
}

export type ConditionKind = 'ALLERGY' | 'CONDITION';

export type ConditionStatus = 'ACTIVE' | 'TREATING' | 'CONTROLLED' | 'RESOLVED';

export type ConditionSeverity = 'MILD' | 'MODERATE' | 'SEVERE';

export interface HealthConditionLink {
  id: string;
  kind: ConditionKind;
  name: string;
}

export interface HealthConditionPayload {
  kind: ConditionKind;
  name: string;
  status: ConditionStatus;
  severity: ConditionSeverity | null;
  since: string | null;
  resolvedAt: string | null;
  reaction: string | null;
  treatment: string | null;
  notes: string | null;
}

export interface HealthCondition extends HealthConditionPayload {
  id: string;
  medications: { id: string; name: string; active: boolean }[];
}

export interface MedicationPayload {
  kind: MedicationKind;
  name: string;
  brand: string | null;
  substance: string | null;
  doseAmount: number | null;
  doseUnit: string | null;
  times: string[];
  timesPerDay: number | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  conditionId: string | null;
}

export type DiaryKind = 'PAIN' | 'SYMPTOM' | 'ALLERGY' | 'DAY' | 'NOTE';

export interface DiaryEntry {
  id: string;
  at: string;
  day: string;
  timeZone: string | null;
  kind: DiaryKind;
  bodyArea: string | null;
  intensity: number | null;
  trigger: string | null;
  text: string | null;
}

export interface DiaryPayload {
  at: string;
  timeZone: string;
  kind: DiaryKind;
  bodyArea: string | null;
  intensity: number | null;
  trigger: string | null;
  text: string | null;
}
