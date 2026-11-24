import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Health_Import_Modal.scss';
import { useHealthImport } from '../../../Hooks/Health/useHealthImport';
import { useOpenGym } from '../../../Hooks/Health/useOpenGym';
import Health_Import_OpenGym from './Health_Import_OpenGym';
import Health_OpenGym_Status from './Health_OpenGym_Status';
import Health_Forms_Panel from '../../Health_Forms/Health_Forms_Panel';
import type {
  HuaweiHeartImportResult,
  HuaweiImportResult,
  HuaweiSkinTemperatureImportResult,
  HuaweiBloodOxygenImportResult,
  HuaweiStressImportResult,
  HuaweiExerciseImportResult,
  HuaweiStepsImportResult,
} from '../../../Hooks/Health/healthTypes';
import { formatDay } from '../../../Pages/Private/Health/Shared/healthFormat';
import { extractDetailReadings, extractExercise, huaweiFilesOf } from './huaweiExport';

type Source = 'huawei' | 'openGym';
type Mode = 'automatic' | 'manual';

const MODES: Mode[] = ['automatic', 'manual'];

const SOURCES: Source[] = ['huawei', 'openGym'];
const SOON_SOURCES = ['apple', 'samsung', 'google'];

interface Health_Import_Modal_Props {
  onClose: () => void;
  onImported: () => void;
}

const Health_Import_Modal = ({ onClose, onImported }: Health_Import_Modal_Props) => {
  const { t } = useTranslation('health');
  const {
    importing,
    setImporting,
    importHuaweiSleep,
    importHuaweiHeart,
    importHuaweiSkinTemperature,
    importHuaweiBloodOxygen,
    importHuaweiStress,
    importHuaweiSteps,
    importHuaweiExercise,
  } = useHealthImport();
  const openGym = useOpenGym();
  const [mode, setMode] = useState<Mode>('automatic');
  const [source, setSource] = useState<Source>('huawei');
  const [files, setFiles] = useState<ReturnType<typeof huaweiFilesOf> | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [sleepResult, setSleepResult] = useState<HuaweiImportResult | null>(null);
  const [heartResult, setHeartResult] = useState<HuaweiHeartImportResult | null>(null);
  const [skinResult, setSkinResult] = useState<HuaweiSkinTemperatureImportResult | null>(null);
  const [oxygenResult, setOxygenResult] = useState<HuaweiBloodOxygenImportResult | null>(null);
  const [stressResult, setStressResult] = useState<HuaweiStressImportResult | null>(null);
  const [stepsResult, setStepsResult] = useState<HuaweiStepsImportResult | null>(null);
  const [exerciseResult, setExerciseResult] = useState<HuaweiExerciseImportResult | null>(null);

  const done = sleepResult || heartResult || skinResult || oxygenResult || stressResult || stepsResult || exerciseResult;
  const nothingFound =
    files && !files.sleep.length && !files.detail.length && !files.workouts.length && !files.activity.length;
  const day = (value: string | null) => (value ? formatDay(value, false) : '—');

  const submit = async () => {
    if (!files || nothingFound) return;
    setImporting(true);
    try {
      if (files.sleep.length) {
        setProgress(t('import.sendingSleep'));
        setSleepResult(await importHuaweiSleep(files.sleep));
      }
      if (files.detail.length) {
        const readings = await extractDetailReadings(files.detail, (current, total) =>
          setProgress(t('import.readingDetail', { current, total })),
        );
        if (readings.heart.heartRate.length) {
          setProgress(t('import.sendingHeart'));
          setHeartResult(await importHuaweiHeart(readings.heart));
        }
        if (readings.skinTemperature.skinTemperature.length) {
          setProgress(t('import.sendingSkinTemperature'));
          setSkinResult(await importHuaweiSkinTemperature(readings.skinTemperature));
        }
        if (readings.bloodOxygen.bloodOxygen.length) {
          setProgress(t('import.sendingBloodOxygen'));
          setOxygenResult(await importHuaweiBloodOxygen(readings.bloodOxygen));
        }
        if (readings.stress.stress.length) {
          setProgress(t('import.sendingStress'));
          setStressResult(await importHuaweiStress(readings.stress));
        }
      }
      if (files.workouts.length || files.activity.length) {
        const exercise = await extractExercise(files.workouts, files.activity, (current, total) =>
          setProgress(t('import.readingExercise', { current, total })),
        );
        if (exercise.activity.length) {
          setProgress(t('import.sendingSteps'));
          setStepsResult(await importHuaweiSteps(exercise.activity));
        }
        if (exercise.workouts.length) {
          setProgress(t('import.sendingExercise'));
          setExerciseResult(await importHuaweiExercise(exercise.workouts));
        }
      }
      onImported();
    } finally {
      setProgress(null);
      setImporting(false);
    }
  };

  return (
    <div className='Health_Import_Modal_Overlay' onClick={() => !importing && onClose()}>
      <div className='Health_Import_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Health_Import_Modal_Head'>
          <span className='Health_Import_Modal_Title'>{t('import.title')}</span>
          <span className='Health_Import_Modal_Text'>{t('import.description')}</span>
        </div>

        <div className='Health_Import_Modal_Modes' role='tablist'>
          {MODES.map((key) => (
            <button
              key={key}
              type='button'
              role='tab'
              aria-selected={mode === key}
              disabled={importing}
              className={mode === key ? 'active' : ''}
              onClick={() => setMode(key)}
            >
              {t(`import.modes.${key}`)}
            </button>
          ))}
        </div>

        {mode === 'manual' && (
          <>
            <div className='Health_Import_Modal_Body'>
              <Health_Forms_Panel onSaved={onImported} />
            </div>
            <div className='Health_Import_Modal_Footer'>
              <button type='button' className='Health_Import_Modal_Close' onClick={onClose}>
                {t('import.close')}
              </button>
            </div>
          </>
        )}

        {mode === 'automatic' && (
        <>
          <div className='Health_Import_Modal_Sources'>
            {SOURCES.map((key) => (
              <button
                key={key}
                type='button'
                disabled={importing}
                aria-pressed={source === key}
                className={`Health_Import_Modal_Source${source === key ? ' active' : ''}`}
                onClick={() => setSource(key)}
              >
                <span className='Health_Import_Modal_Source_top'>
                  <span className='Health_Import_Modal_Source_name'>{t(`import.sources.${key}`)}</span>
                  {key === 'openGym' && openGym.connection?.connected && <Health_OpenGym_Status status={openGym.status} />}
                </span>
                <span className='Health_Import_Modal_Source_hint'>{t(`import.sourceHints.${key}`)}</span>
              </button>
            ))}
          </div>

          <span className='Health_Import_Modal_Soon'>
            {t('import.soonSources', { sources: SOON_SOURCES.map((key) => t(`import.sources.${key}`)).join(' · ') })}
          </span>

          {source === 'openGym' && <Health_Import_OpenGym openGym={openGym} onSynced={onImported} onClose={onClose} />}

          {source === 'huawei' && (
            <div className='Health_Import_Modal_Body'>
              <span className='Health_Import_Modal_Text'>{t('import.huaweiHelp')}</span>

              <label className={`Health_Import_Modal_Pick ${importing ? 'disabled' : ''}`}>
                <input
                  type='file'
                  multiple
                  disabled={importing}
                  ref={(input) => input?.setAttribute('webkitdirectory', '')}
                  onChange={(e) => {
                    setFiles(huaweiFilesOf(e.target.files));
                    setSleepResult(null);
                    setHeartResult(null);
                    setSkinResult(null);
                    setOxygenResult(null);
                    setStressResult(null);
                    setStepsResult(null);
                    setExerciseResult(null);
                  }}
                />
                {t('import.chooseFolder')}
              </label>

              {files && !nothingFound && (
                <span className='Health_Import_Modal_Info'>
                  {t('import.filesFound', {
                    sleep: files.sleep.length,
                    detail: files.detail.length,
                    exercise: files.workouts.length + files.activity.length,
                  })}
                </span>
              )}
              {nothingFound && <span className='Health_Import_Modal_Info error'>{t('import.noFiles')}</span>}
              {progress && <span className='Health_Import_Modal_Info'>{progress}</span>}

              {sleepResult && (
                <span className='Health_Import_Modal_Info success'>
                  {t('import.doneSleep', {
                    nights: sleepResult.nights,
                    naps: sleepResult.naps,
                    created: sleepResult.created,
                    updated: sleepResult.updated,
                    from: day(sleepResult.from),
                    to: day(sleepResult.to),
                  })}
                </span>
              )}
              {heartResult && (
                <span className='Health_Import_Modal_Info success'>
                  {t('import.doneHeart', {
                    days: heartResult.days,
                    created: heartResult.created,
                    updated: heartResult.updated,
                    from: day(heartResult.from),
                    to: day(heartResult.to),
                  })}
                </span>
              )}
              {skinResult && (
                <span className='Health_Import_Modal_Info success'>
                  {t('import.doneSkinTemperature', {
                    days: skinResult.days,
                    created: skinResult.created,
                    updated: skinResult.updated,
                    from: day(skinResult.from),
                    to: day(skinResult.to),
                  })}
                </span>
              )}
              {oxygenResult && (
                <span className='Health_Import_Modal_Info success'>
                  {t('import.doneBloodOxygen', {
                    days: oxygenResult.days,
                    created: oxygenResult.created,
                    updated: oxygenResult.updated,
                    from: day(oxygenResult.from),
                    to: day(oxygenResult.to),
                  })}
                </span>
              )}
              {stressResult && (
                <span className='Health_Import_Modal_Info success'>
                  {t('import.doneStress', {
                    days: stressResult.days,
                    created: stressResult.created,
                    updated: stressResult.updated,
                    from: day(stressResult.from),
                    to: day(stressResult.to),
                  })}
                </span>
              )}
              {stepsResult && (
                <span className='Health_Import_Modal_Info success'>
                  {t('import.doneSteps', {
                    days: stepsResult.days,
                    created: stepsResult.created,
                    updated: stepsResult.updated,
                    from: day(stepsResult.from),
                    to: day(stepsResult.to),
                  })}
                </span>
              )}
              {exerciseResult && (
                <span className='Health_Import_Modal_Info success'>
                  {t('import.doneExercise', {
                    workouts: exerciseResult.workouts,
                    from: day(exerciseResult.from),
                    to: day(exerciseResult.to),
                  })}
                </span>
              )}
            </div>
          )}

          {source === 'huawei' && (
          <div className='Health_Import_Modal_Footer'>
            <button type='button' className='Health_Import_Modal_Close' onClick={onClose} disabled={importing}>
              {t(done ? 'import.close' : 'import.cancel')}
            </button>
            {!done && (
              <button
                type='button'
                className='Health_Import_Modal_Submit'
                onClick={submit}
                disabled={importing || !files || !!nothingFound}
              >
                {t(importing ? 'import.importing' : 'import.submit')}
              </button>
            )}
          </div>
          )}
        </>
        )}
      </div>
    </div>
  );
};

export default Health_Import_Modal;
