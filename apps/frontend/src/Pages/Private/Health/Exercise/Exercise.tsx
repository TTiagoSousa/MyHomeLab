import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import './Exercise.scss';
import { useExercise } from '../../../../Hooks/Health/useExercise';
import Error_Boundary from '../../../../Components/Error_Boundary/Error_Boundary';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { formatDay } from '../Shared/healthFormat';
import Exercise_Average_Tiles from './Exercise_Average_Tiles';
import Exercise_Workouts_Chart from './Exercise_Workouts_Chart';
import Exercise_Workouts_Panel from './Exercise_Workouts_Panel';
import Exercise_All_Workouts_Modal from './Exercise_All_Workouts_Modal';
import Exercise_Moves_Panel from './Exercise_Moves_Panel';
import Exercise_Sync_Result from './Exercise_Sync_Result';
import Workout_Modal from '../../../../Components/Modals/Workout_Modal/Workout_Modal';

const Exercise = () => {
  const { t } = useTranslation('health');
  const navigate = useNavigate();
  const [days, setDays] = useState(30);
  const [allOpen, setAllOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { averages, workouts, moves, loading, syncing, syncResult, error, fetchExercise, syncWorkouts } = useExercise(days);

  const openWorkout = (id: string) => navigate(`/MyHomeLab/Health/Exercise/${id}`);

  return (
    <div className='Health_Dashboard Exercise_Page'>
      <Health_Dashboard_Header
        title={t('exercise.title')}
        days={days}
        onDays={setDays}
        action={
          <>
            <button
              type='button'
              className='Health_see_all'
              title={t('workoutSync.refreshHint')}
              disabled={syncing}
              onClick={() => void syncWorkouts()}
            >
              {syncing ? t('workoutSync.refreshing') : t('workoutSync.refresh')}
            </button>
            <button type='button' className='Health_see_all' onClick={() => setAddOpen(true)}>
              {t('exercise.manual.add')}
            </button>
          </>
        }
      />

      {syncResult && <Exercise_Sync_Result result={syncResult} />}

      {error && <div className='Health_empty'>{error}</div>}

      {!loading && !error && !averages && (
        <div className='Health_empty'>
          <span className='Health_empty_title'>{t('empty.title')}</span>
          <span>{t('empty.text')}</span>
        </div>
      )}

      {averages && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('averages.title')}</span>
              {averages.from && averages.to && (
                <p className='Health_card_description'>
                  {t('exercise.basedOn', {
                    count: averages.workouts,
                    from: formatDay(averages.from, false),
                    to: formatDay(averages.to, false),
                  })}
                </p>
              )}
            </div>
          </div>
          <Exercise_Average_Tiles averages={averages} detailed />
        </section>
      )}

      {averages && workouts.length > 0 && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('exercise.trendTitle')}</span>
              <p className='Health_card_description'>{t('exercise.trendHint')}</p>
            </div>
          </div>
          <Error_Boundary>
            <Exercise_Workouts_Chart workouts={workouts} onOpen={openWorkout} />
          </Error_Boundary>
        </section>
      )}

      {moves.length > 0 && <Exercise_Moves_Panel moves={moves} />}

      {averages && (
        <Exercise_Workouts_Panel workouts={workouts} onOpen={openWorkout} onSeeAll={() => setAllOpen(true)} />
      )}

      {allOpen && <Exercise_All_Workouts_Modal onOpen={openWorkout} onClose={() => setAllOpen(false)} />}

      {addOpen && (
        <Workout_Modal
          existing={null}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            fetchExercise();
          }}
        />
      )}
    </div>
  );
};

export default Exercise;
