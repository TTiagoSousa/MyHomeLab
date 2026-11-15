import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import './Exercise.scss';
import { useWorkout } from '../../../../Hooks/Health/useWorkout';
import { useManualWorkout } from '../../../../Hooks/Health/useManualWorkout';
import Workout_Modal from '../../../../Components/Modals/Workout_Modal/Workout_Modal';
import Workout_Parts_Modal from '../../../../Components/Modals/Workout_Parts_Modal/Workout_Parts_Modal';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay, formatDistance, formatSteps, localClock, valueOrDash } from '../Shared/healthFormat';
import Exercise_Effort_Bar from './Exercise_Effort_Bar';
import Exercise_Route_Map from './Exercise_Route_Map';
import Exercise_Workout_Chart from './Exercise_Workout_Chart';
import Exercise_Workout_Context from './Exercise_Workout_Context';
import Exercise_Workout_Splits from './Exercise_Workout_Splits';
import Exercise_Workout_Exercises from './Exercise_Workout_Exercises';
import Exercise_Workout_Sync from './Exercise_Workout_Sync';
import Exercise_Workout_Session from './Exercise_Workout_Session';
import { formatPace, formatWeight, formatWorkoutDuration, typeName, workingSets, zonesTotal } from './exerciseFormat';

const Exercise_Workout_Page = () => {
  const { t } = useTranslation('health');
  const navigate = useNavigate();
  const { workoutId } = useParams();
  const { workout, loading, syncing, syncResult, error, fetchWorkout, syncWorkout, saveParts, detachPart } = useWorkout(
    workoutId ?? null,
  );
  const { deleteWorkout } = useManualWorkout();
  const [editOpen, setEditOpen] = useState(false);
  const [partsOpen, setPartsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bpm = ` ${t('units.bpm')}`;
  const manual = workout?.source === 'MANUAL';
  const openGym = workout?.source === 'OPENGYM';
  const recorded = manual || openGym;
  const exercises = workout?.exercises ?? [];
  const sets = exercises.flatMap(workingSets);
  const reps = sets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
  const records = exercises.filter((exercise) => exercise.record).length;
  const hasContext = Boolean(
    workout?.context.restingBpm ||
      workout?.context.skinSummary ||
      workout?.context.oxygenSummary ||
      workout?.context.stressSummary,
  );
  const hasHeartChart = Boolean(workout?.heartRate?.length || workout?.altitude?.length || zonesTotal(workout?.heartZones ?? null));

  const handleDelete = async () => {
    if (!workout) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (await deleteWorkout(workout.id)) navigate('/MyHomeLab/Health/Exercise');
    else setConfirmDelete(false);
  };

  return (
    <div className='Health_Dashboard'>
      <header>
        <div className='Right_Side'>
          <button type='button' className='Health_back' onClick={() => navigate('/MyHomeLab/Health/Exercise')}>
            ← {t('exercise.title')}
          </button>
          <span>{workout ? (workout.title ?? typeName(t, workout.typeId)) : t('exercise.workoutTitle')}</span>
        </div>

        {manual && (
          <div className='Left_Side'>
            <button type='button' className='Health_see_all' onClick={() => setEditOpen(true)}>
              {t('exercise.manual.edit')}
            </button>
            <button
              type='button'
              className={`Health_see_all danger${confirmDelete ? ' confirm' : ''}`}
              onClick={() => void handleDelete()}
              onBlur={() => setConfirmDelete(false)}
            >
              {confirmDelete ? t('exercise.manual.confirmDelete') : t('exercise.manual.delete')}
            </button>
          </div>
        )}
      </header>

      {error && <div className='Health_empty'>{error}</div>}
      {!workout && !error && <div className='Health_empty'>{loading ? t('loading') : ''}</div>}

      {workout && (
        <>
          <section className='Health_card'>
            <div className='Health_card_head'>
              <div>
                <span className='Health_card_title'>{formatDay(workout.day)}</span>
                <p className='Health_card_description'>
                  {t('exercise.workoutDescription', {
                    time: localClock(workout.startAt, workout.timeZone),
                    duration: formatWorkoutDuration(workout.durationSec),
                  })}
                  {openGym ? ` · ${t('exercise.openGym.fromOpenGym', { type: typeName(t, workout.typeId) })}` : ''}
                </p>
              </div>
            </div>

            {recorded ? (
              <>
                <div className='Health_Stats columns-5'>
                  <Health_Stat highlight label={t('exercise.metrics.duration')} value={formatWorkoutDuration(workout.durationSec)} />
                  <Health_Stat
                    label={t('exercise.metrics.workoutCaloriesOne')}
                    value={valueOrDash(workout.calories, ' kcal')}
                    sub={workout.caloriesEstimated && workout.calories != null ? t('workoutSync.estimated') : undefined}
                  />
                  <Health_Stat
                    label={t('workoutSync.difficulty')}
                    value={workout.difficulty == null ? '—' : t('workoutSync.difficultyValue', { value: workout.difficulty })}
                  />
                  <Health_Stat label={t('exercise.metrics.avgHeart')} value={valueOrDash(workout.avgHeartRate, bpm)} />
                  <Health_Stat
                    label={t('exercise.metrics.maxHeart')}
                    value={valueOrDash(workout.maxHeartRate, bpm)}
                    sub={workout.minHeartRate ? t('exercise.metrics.minHeartSub', { value: workout.minHeartRate }) : undefined}
                  />
                </div>
                {openGym && (
                  <div className='Health_Stats columns-5'>
                    <Health_Stat label={t('exercise.openGym.statExercises')} value={String(exercises.length)} />
                    <Health_Stat label={t('exercise.openGym.statSets')} value={String(sets.length)} />
                    <Health_Stat label={t('exercise.openGym.statReps')} value={reps ? String(reps) : '—'} />
                    <Health_Stat
                      label={t('exercise.openGym.statVolume')}
                      value={workout.volumeKg ? formatWeight(Math.round(workout.volumeKg)) : '—'}
                      sub={t('exercise.openGym.statVolumeSub')}
                    />
                    <Health_Stat label={t('exercise.openGym.statRecords')} value={String(records)} />
                  </div>
                )}
                {manual && workout.distanceM ? (
                  <div className='Health_Stats columns-4'>
                    <Health_Stat label={t('workoutSync.distance')} value={formatDistance(workout.distanceM)} />
                  </div>
                ) : null}
              </>
            ) : (
            <div className='Health_Stats columns-5'>
              <Health_Stat highlight label={t('exercise.metrics.duration')} value={formatWorkoutDuration(workout.durationSec)} />
              <Health_Stat label={t('exercise.metrics.workoutDistance')} value={formatDistance(workout.distanceM)} />
              <Health_Stat label={t('exercise.metrics.workoutCaloriesOne')} value={valueOrDash(workout.calories, ' kcal')} />
              <Health_Stat label={t('exercise.metrics.avgHeart')} value={valueOrDash(workout.avgHeartRate, bpm)} />
              <Health_Stat
                label={t('exercise.metrics.maxHeart')}
                value={valueOrDash(workout.maxHeartRate, bpm)}
                sub={workout.minHeartRate ? t('exercise.metrics.minHeartSub', { value: workout.minHeartRate }) : undefined}
              />
            </div>
            )}

            {!recorded && (
            <div className='Health_Stats columns-5'>
              <Health_Stat label={t('exercise.metrics.pace')} value={formatPace(workout.avgPace)} />
              <Health_Stat label={t('exercise.metrics.workoutSteps')} value={formatSteps(workout.steps)} />
              <Health_Stat
                label={t('exercise.metrics.cadence')}
                value={valueOrDash(workout.avgCadence, ` ${t('exercise.units.perMinute')}`)}
              />
              <Health_Stat
                label={t('exercise.metrics.ascent')}
                value={workout.ascentM == null ? '—' : `${Math.round(workout.ascentM)} m`}
                sub={workout.descentM ? t('exercise.metrics.descentSub', { value: Math.round(workout.descentM) }) : undefined}
              />
              <Health_Stat
                label={t('exercise.metrics.trainingEffect')}
                value={workout.trainingEffect == null ? '—' : workout.trainingEffect.toFixed(1)}
                sub={
                  workout.recoveryMin
                    ? t('exercise.metrics.recoverySub', { hours: Math.round(workout.recoveryMin / 60) })
                    : undefined
                }
              />
            </div>
            )}
          </section>

          <Exercise_Workout_Session
            workout={workout}
            onOpen={(id) => navigate(`/MyHomeLab/Health/Exercise/${id}`)}
            onEdit={() => setPartsOpen(true)}
            onDetach={(id) => void detachPart(id)}
          />

          {recorded && (
            <Exercise_Workout_Sync workout={workout} syncing={syncing} result={syncResult} onSync={() => void syncWorkout()} />
          )}

          {exercises.length ? <Exercise_Workout_Exercises exercises={exercises} /> : null}

          {workout.partExercises.map((part) => (
            <Exercise_Workout_Exercises
              key={part.id}
              exercises={part.exercises}
              title={t('exercise.openGym.partExercisesTitle', { name: part.title ?? typeName(t, 'strength') })}
            />
          ))}

          {workout.notes ? (
            <section className='Health_card'>
              <div className='Health_card_head'>
                <span className='Health_card_title'>{t('exercise.manual.notesTitle')}</span>
              </div>
              <p className='Health_Notes'>{workout.notes}</p>
            </section>
          ) : null}

          {workout.route?.length ? (
            <section className='Health_card'>
              <div className='Health_card_head'>
                <div>
                  <span className='Health_card_title'>{t('exercise.mapTitle')}</span>
                  <p className='Health_card_description'>{t('exercise.mapDescription')}</p>
                </div>
              </div>
              <Error_Boundary>
                <Exercise_Route_Map route={workout.route} />
              </Error_Boundary>
              <div className='Health_Chart_Legend'>
                <span>
                  <i className='line route' />
                  {t('exercise.series.route')}
                </span>
                <span>
                  <i className='dot start' />
                  {t('exercise.series.start')}
                </span>
                <span>
                  <i className='dot end' />
                  {t('exercise.series.end')}
                </span>
              </div>
            </section>
          ) : null}

          {hasHeartChart && (
          <section className='Health_card'>
            <div className='Health_card_head'>
              <div>
                <span className='Health_card_title'>{t('exercise.chartTitle')}</span>
                <p className='Health_card_description'>{t('exercise.chartDescription')}</p>
              </div>
            </div>
            <div className='Health_Box'>
              <Error_Boundary>
                <Exercise_Workout_Chart workout={workout} />
              </Error_Boundary>
              <div className='Health_Chart_Legend'>
                {workout.heartRate?.length ? (
                  <span>
                    <i className='line heart' />
                    {t('exercise.series.heartRate')}
                  </span>
                ) : null}
                {workout.altitude?.length ? (
                  <span>
                    <i className='line altitude' />
                    {t('exercise.series.altitudeAxis')}
                  </span>
                ) : null}
              </div>
              <Exercise_Effort_Bar zones={workout.heartZones} showLegend />
            </div>
          </section>
          )}

          {workout.splits?.length ? <Exercise_Workout_Splits splits={workout.splits} /> : null}

          {(!recorded || hasContext) && <Exercise_Workout_Context workout={workout} />}
        </>
      )}

      {partsOpen && workout && (
        <Workout_Parts_Modal workout={workout} onSave={saveParts} onClose={() => setPartsOpen(false)} />
      )}

      {editOpen && workout && (
        <Workout_Modal
          existing={workout}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            fetchWorkout();
          }}
        />
      )}
    </div>
  );
};

export default Exercise_Workout_Page;
