import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../../../../Hooks/Health/healthTypes';
import { formatDay, localClock } from '../Shared/healthFormat';
import { areaLabelKey, intensityClass } from './diaryFormat';

interface Diary_Entry_Item_Props {
  entry: DiaryEntry;
  context: DiaryEntry[];
  confirming: boolean;
  onEdit: (entry: DiaryEntry) => void;
  onRemove: (id: string) => void;
  onCancelRemove: () => void;
}

const Diary_Entry_Item = ({ entry, context, confirming, onEdit, onRemove, onCancelRemove }: Diary_Entry_Item_Props) => {
  const { t } = useTranslation('health');

  return (
    <div className={`Diary_Entry ${entry.kind.toLowerCase()}`}>
      <div className='Diary_Entry_Head'>
        <em>{localClock(entry.at, entry.timeZone)}</em>
        <span className='Diary_Kind'>{t(`diary.kinds.${entry.kind}`)}</span>
        {entry.bodyArea && <span>{t(areaLabelKey(entry.kind, entry.bodyArea))}</span>}
        {entry.intensity != null && (
          <span className={`Diary_Intensity ${intensityClass(entry.intensity)}`}>
            {t('diary.intensityShort', { value: entry.intensity })}
          </span>
        )}
        <span className='Diary_Entry_Actions'>
          <button type='button' className='Health_see_all' onClick={() => onEdit(entry)}>
            {t('diary.edit')}
          </button>
          <button
            type='button'
            className={`Health_see_all danger${confirming ? ' confirm' : ''}`}
            onClick={() => onRemove(entry.id)}
            onBlur={onCancelRemove}
          >
            {confirming ? t('diary.confirmRemove') : t('diary.remove')}
          </button>
        </span>
      </div>

      {entry.trigger && <span className='Diary_Trigger'>{t('diary.triggerShort', { value: entry.trigger })}</span>}
      {entry.text && <p>{entry.text}</p>}

      {entry.kind === 'ALLERGY' && (
        <div className='Diary_Context'>
          <span className='Diary_Context_Title'>{t('diary.contextTitle')}</span>
          {context.length ? (
            context.map((item) => (
              <span key={item.id} className='Diary_Context_Item'>
                <em>
                  {formatDay(item.day, false)} · {localClock(item.at, item.timeZone)} · {t(`diary.kinds.${item.kind}`)}
                </em>
                {item.text}
              </span>
            ))
          ) : (
            <span className='Diary_Context_Empty'>{t('diary.contextEmpty')}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default Diary_Entry_Item;
