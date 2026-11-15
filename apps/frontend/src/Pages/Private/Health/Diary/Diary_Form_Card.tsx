import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import type { DiaryEntry, DiaryKind, DiaryPayload } from '../../../../Hooks/Health/healthTypes';
import { browserTimeZone, dateInput, timeInput } from '../Shared/healthFormat';
import { DIARY_KINDS, TEXT_KINDS, areaLabelKey, areasOf } from './diaryFormat';

interface Diary_Form_Card_Props {
  editing: DiaryEntry | null;
  saving: boolean;
  onSave: (payload: DiaryPayload, id?: string) => Promise<string | null>;
  onCancel: () => void;
}

const Diary_Form_Card = ({ editing, saving, onSave, onCancel }: Diary_Form_Card_Props) => {
  const { t } = useTranslation('health');
  const start = editing ? new Date(editing.at) : new Date();
  const [kind, setKind] = useState<DiaryKind>(editing?.kind ?? 'PAIN');
  const [date, setDate] = useState(dateInput(start));
  const [time, setTime] = useState(timeInput(start));
  const [bodyArea, setBodyArea] = useState(editing?.bodyArea ?? 'head');
  const [intensity, setIntensity] = useState(editing?.intensity ?? 5);
  const [trigger, setTrigger] = useState(editing?.trigger ?? '');
  const [text, setText] = useState(editing?.text ?? '');
  const [error, setError] = useState('');

  const at = new Date(`${date}T${time}`);
  const areas = areasOf(kind);
  const area = areas ? (areas.includes(bodyArea) ? bodyArea : areas[0]) : null;
  const needsText = TEXT_KINDS.includes(kind);
  const canSave = !saving && !Number.isNaN(at.getTime()) && (!needsText || text.trim().length > 0);

  const handleSave = async () => {
    if (!canSave) return;
    const failure = await onSave(
      {
        at: at.toISOString(),
        timeZone: browserTimeZone(at),
        kind,
        bodyArea: area,
        intensity: needsText ? null : intensity,
        trigger: kind === 'ALLERGY' ? trigger.trim() || null : null,
        text: text.trim() || null,
      },
      editing?.id,
    );
    if (failure) setError(failure);
    else {
      setError('');
      setText('');
      setTrigger('');
      if (editing) onCancel();
    }
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{editing ? t('diary.editTitle') : t('diary.addTitle')}</span>
          <p className='Health_card_description'>{t('diary.addDescription')}</p>
        </div>
      </div>

      <div className='Diary_Kinds'>
        {DIARY_KINDS.map((option) => (
          <button key={option} type='button' className={option === kind ? 'active' : ''} onClick={() => setKind(option)}>
            {t(`diary.kinds.${option}`)}
          </button>
        ))}
      </div>

      <div className='Health_Form diary'>
        <div className='Health_Form_Field'>
          <label htmlFor='diary-date'>{t('diary.date')}</label>
          <Global_Input id='diary-date' type='date' value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className='Health_Form_Field'>
          <label htmlFor='diary-time'>{t('diary.time')}</label>
          <Global_Input id='diary-time' type='time' value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        {areas && area && (
          <div className='Health_Form_Field'>
            <label htmlFor='diary-area'>{kind === 'ALLERGY' ? t('diary.allergyArea') : t('diary.bodyArea')}</label>
            <Global_Dropdown
              id='diary-area'
              value={area}
              onChange={setBodyArea}
              searchable
              maxVisibleOptions={8}
              options={areas.map((option) => ({ value: option, label: t(areaLabelKey(kind, option)) }))}
            />
          </div>
        )}
        {!needsText && (
          <div className='Health_Form_Field'>
            <label htmlFor='diary-intensity'>{t('diary.intensity', { value: intensity })}</label>
            <input
              id='diary-intensity'
              className='Diary_Range'
              type='range'
              min={0}
              max={10}
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
            />
          </div>
        )}
      </div>

      {kind === 'ALLERGY' && (
        <div className='Health_Form_Field'>
          <label htmlFor='diary-trigger'>{t('diary.trigger')}</label>
          <Global_Input
            id='diary-trigger'
            value={trigger}
            maxLength={300}
            placeholder={t('diary.triggerPlaceholder')}
            onChange={(e) => setTrigger(e.target.value)}
          />
        </div>
      )}

      <div className='Health_Form_Field'>
        <label htmlFor='diary-text'>{t(`diary.textLabels.${kind}`)}</label>
        <textarea
          id='diary-text'
          className='Diary_Text'
          rows={3}
          maxLength={4000}
          value={text}
          placeholder={t(`diary.placeholders.${kind}`)}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      {error && <p className='Health_Form_Error'>{error}</p>}

      <div className='Diary_Actions'>
        {editing && (
          <button type='button' className='Health_see_all' onClick={onCancel}>
            {t('common:actions.cancel')}
          </button>
        )}
        <button type='button' className='Health_Form_Save' disabled={!canSave} onClick={() => void handleSave()}>
          {saving ? t('diary.saving') : t('diary.save')}
        </button>
      </div>
    </section>
  );
};

export default Diary_Form_Card;
