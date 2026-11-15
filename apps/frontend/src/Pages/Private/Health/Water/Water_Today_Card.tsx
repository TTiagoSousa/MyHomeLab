import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import type { WaterDay } from '../../../../Hooks/Health/healthTypes';
import { formatDay, localClock } from '../Shared/healthFormat';
import Water_Goal_Bar from './Water_Goal_Bar';
import { QUICK_AMOUNTS, formatMl } from './waterFormat';

interface Water_Today_Card_Props {
  day: string;
  isToday: boolean;
  minDay: string;
  maxDay: string;
  entries: WaterDay | null;
  goal: number;
  saving: boolean;
  onDay: (day: string) => void;
  onAdd: (ml: number) => void;
  onRemove: (id: string) => void;
}

const Water_Today_Card = ({ day, isToday, minDay, maxDay, entries, goal, saving, onDay, onAdd, onRemove }: Water_Today_Card_Props) => {
  const { t } = useTranslation('health');
  const [custom, setCustom] = useState('');
  const total = entries?.ml ?? 0;
  const customMl = Number(custom);
  const canAddCustom = !saving && Number.isInteger(customMl) && customMl >= 1 && customMl <= 5000;

  const addCustom = () => {
    if (!canAddCustom) return;
    onAdd(customMl);
    setCustom('');
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{isToday ? t('water.todayTitle') : formatDay(day)}</span>
          <p className='Health_card_description'>{t('water.todayDescription')}</p>
        </div>
        <div className='Water_Day_Picker'>
          <label htmlFor='water-day'>{t('water.day')}</label>
          <Global_Input
            id='water-day'
            type='date'
            value={day}
            min={minDay}
            max={maxDay}
            onChange={(e) => {
              if (e.target.value) onDay(e.target.value);
            }}
          />
        </div>
        <div className='Water_Today_Total'>
          <em>{t('water.todayOf', { value: formatMl(total), goal: formatMl(goal) })}</em>
          <small>{total >= goal ? t('water.goalReached') : t('water.left', { value: formatMl(goal - total) })}</small>
        </div>
      </div>

      <Water_Goal_Bar ml={total} goal={goal} />

      <div className='Water_Quick'>
        {QUICK_AMOUNTS.map((amount) => (
          <button key={amount} type='button' disabled={saving} onClick={() => onAdd(amount)}>
            +{formatMl(amount)}
          </button>
        ))}
        <div className='Water_Custom'>
          <Global_Input
            type='number'
            value={custom}
            placeholder={t('water.custom')}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addCustom();
            }}
          />
          <button type='button' disabled={!canAddCustom} onClick={addCustom}>
            {t('water.add')}
          </button>
        </div>
      </div>

      {entries?.entries.length ? (
        <div className='Water_Entries'>
          {entries.entries.map((entry) => (
            <span key={entry.id} className='Water_Entry'>
              {localClock(entry.drankAt, entry.timeZone)} · {formatMl(entry.ml)}
              <button type='button' aria-label={t('water.remove')} title={t('water.remove')} onClick={() => onRemove(entry.id)}>
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <span className='Health_chart_empty'>{isToday ? t('water.noneToday') : t('water.noneOnDay', { date: formatDay(day, false) })}</span>
      )}
    </section>
  );
};

export default Water_Today_Card;
