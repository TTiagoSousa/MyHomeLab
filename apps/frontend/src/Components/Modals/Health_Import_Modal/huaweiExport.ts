import type {
  ActivityMinute,
  HeartReading,
  HuaweiDetailReadings,
  HuaweiExercisePayload,
  HuaweiWorkoutRecord,
} from '../../../Hooks/Health/healthTypes';

const SLEEP_FOLDER = 'Sample sequence data';
const DETAIL_FOLDER = 'Health detail data';
const WORKOUT_FOLDER = 'Motion path detail data';
const ACTIVITY_FOLDER = 'Sport per minute merged data';
const WORKOUT_SERIES = ['tp=h-r;', 'tp=s-r;', 'tp=alti;', 'tp=lbs;'];
const HEART_RATE_TYPE = 7;
const HRV_TYPE = 500044;
const SKIN_TEMPERATURE_TYPE = 400012;
const BLOOD_OXYGEN_TYPE = 400021;
const STRESS_TYPE = 500026;
const WANTED_TYPES = [HEART_RATE_TYPE, HRV_TYPE, SKIN_TEMPERATURE_TYPE, BLOOD_OXYGEN_TYPE, STRESS_TYPE];
const HEART_RATE_KEY = 'DATA_POINT_DYNAMIC_HEARTRATE';
const RESTING_KEY = 'DATA_POINT_NEW_REST_HEARTRATE';

interface HuaweiRecord {
  type?: number;
  timeZone?: string;
  samplePoints?: { key?: string; startTime?: number; value?: string }[];
}

const isJsonIn = (file: File, folder: string) =>
  file.webkitRelativePath.includes(folder) && file.name.toLowerCase().endsWith('.json');

export const huaweiFilesOf = (files: FileList | null) => {
  const list = Array.from(files ?? []);
  return {
    sleep: list.filter((file) => isJsonIn(file, SLEEP_FOLDER)),
    detail: list.filter((file) => isJsonIn(file, DETAIL_FOLDER)),
    workouts: list.filter((file) => isJsonIn(file, WORKOUT_FOLDER)),
    activity: list.filter((file) => isJsonIn(file, ACTIVITY_FOLDER)),
  };
};

const recordTypeOf = async (file: File) => {
  const head = await file.slice(0, 4096).text();
  const match = /"type":(\d+)/.exec(head);
  return match ? Number(match[1]) : null;
};

const jsonField = (value: string | undefined, field: string) => {
  try {
    return Number(JSON.parse(value ?? '')[field]);
  } catch {
    return NaN;
  }
};

const readingsOf = (records: HuaweiRecord[], readings: HuaweiDetailReadings) => {
  for (const record of records) {
    const timeZone = record.timeZone ?? null;
    for (const point of record.samplePoints ?? []) {
      if (typeof point.startTime !== 'number') continue;
      const reading = (value: number) => [point.startTime, value, timeZone] as HeartReading;
      if (record.type === HEART_RATE_TYPE && point.key === HEART_RATE_KEY) {
        readings.heart.heartRate.push(reading(Number(point.value)));
      } else if (record.type === HEART_RATE_TYPE && point.key === RESTING_KEY) {
        readings.heart.resting.push(reading(Number(point.value)));
      } else if (record.type === HRV_TYPE) {
        readings.heart.hrv.push(reading(jsonField(point.value, 'heartRateVariabilityRMSSD')));
      } else if (record.type === SKIN_TEMPERATURE_TYPE) {
        readings.skinTemperature.skinTemperature.push(reading(jsonField(point.value, 'skinTemperature')));
      } else if (record.type === BLOOD_OXYGEN_TYPE) {
        readings.bloodOxygen.bloodOxygen.push(reading(jsonField(point.value, 'spo2')));
      } else if (record.type === STRESS_TYPE) {
        readings.stress.stress.push(reading(jsonField(point.value, 'stressScore')));
      }
    }
  }
};

export const extractDetailReadings = async (files: File[], onProgress: (done: number, total: number) => void) => {
  const readings: HuaweiDetailReadings = {
    heart: { heartRate: [], resting: [], hrv: [] },
    skinTemperature: { skinTemperature: [] },
    bloodOxygen: { bloodOxygen: [] },
    stress: { stress: [] },
  };
  const wanted: File[] = [];
  for (const file of files) {
    const type = await recordTypeOf(file);
    if (type != null && WANTED_TYPES.includes(type)) wanted.push(file);
  }

  for (const [index, file] of wanted.entries()) {
    onProgress(index, wanted.length);
    try {
      const records = JSON.parse(await file.text());
      if (Array.isArray(records)) readingsOf(records as HuaweiRecord[], readings);
    } catch {
      continue;
    }
  }
  onProgress(wanted.length, wanted.length);
  return readings;
};

interface HuaweiWorkoutFileRecord {
  recordId?: string;
  startTime?: number;
  endTime?: number;
  timeZone?: string;
  summaryData?: string;
  detailData?: string;
}

interface HuaweiActivityFileDay {
  sportDataUserData?: {
    startTime?: number;
    timeZone?: string;
    sportBasicInfos?: { steps?: number; distance?: number; calorie?: number }[];
  }[];
}

const readJsonArray = async <Item,>(file: File): Promise<Item[]> => {
  try {
    const parsed = JSON.parse(await file.text());
    return Array.isArray(parsed) ? (parsed as Item[]) : [];
  } catch {
    return [];
  }
};

const workoutOf = (record: HuaweiWorkoutFileRecord): HuaweiWorkoutRecord | null => {
  if (!record.recordId || typeof record.startTime !== 'number' || typeof record.endTime !== 'number') return null;
  if (typeof record.summaryData !== 'string') return null;
  const detail = (record.detailData ?? '')
    .split('\n')
    .filter((line) => WORKOUT_SERIES.some((prefix) => line.startsWith(prefix)))
    .join('\n');
  return {
    recordId: record.recordId,
    startTime: record.startTime,
    endTime: record.endTime,
    timeZone: record.timeZone ?? null,
    summaryData: record.summaryData,
    detail,
  };
};

export const extractExercise = async (
  workoutFiles: File[],
  activityFiles: File[],
  onProgress: (done: number, total: number) => void,
): Promise<HuaweiExercisePayload> => {
  const payload: HuaweiExercisePayload = { activity: [], workouts: [] };
  const total = workoutFiles.length + activityFiles.length;
  let done = 0;

  for (const file of workoutFiles) {
    onProgress(done++, total);
    for (const record of await readJsonArray<HuaweiWorkoutFileRecord>(file)) {
      const workout = workoutOf(record);
      if (workout) payload.workouts.push(workout);
    }
  }

  for (const file of activityFiles) {
    onProgress(done++, total);
    for (const day of await readJsonArray<HuaweiActivityFileDay>(file)) {
      for (const minute of day.sportDataUserData ?? []) {
        if (typeof minute.startTime !== 'number') continue;
        for (const info of minute.sportBasicInfos ?? []) {
          payload.activity.push([
            minute.startTime,
            info.steps ?? 0,
            info.distance ?? 0,
            info.calorie ?? 0,
            minute.timeZone ?? null,
          ] as ActivityMinute);
        }
      }
    }
  }

  onProgress(total, total);
  return payload;
};
