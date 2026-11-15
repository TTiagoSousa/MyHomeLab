import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import type { ProgressPhotoUpload } from '../../../../Hooks/Health/useBody';
import type { PhotoPose } from '../../../../Hooks/Health/healthLogTypes';
import { dateInput } from '../Shared/healthFormat';
import { PHOTO_POSES, PHOTO_TYPES } from './bodyFormat';

interface Body_Photos_Card_Props {
  saving: boolean;
  onUpload: (upload: ProgressPhotoUpload) => Promise<string | null>;
}

const Body_Photos_Card = ({ saving, onUpload }: Body_Photos_Card_Props) => {
  const { t } = useTranslation('health');
  const today = dateInput(new Date());
  const fileRef = useRef<HTMLInputElement>(null);
  const [day, setDay] = useState(today);
  const [pose, setPose] = useState<PhotoPose>('FRONT');
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const canSave = !saving && file != null && /^\d{4}-\d{2}-\d{2}$/.test(day) && day <= today;

  const pickFile = (picked: File | undefined) => {
    if (!picked) return;
    if (!PHOTO_TYPES.includes(picked.type)) {
      setError(t('body.photos.invalidType'));
      return;
    }
    setFile(picked);
    setError('');
  };

  const handleSave = async () => {
    if (!canSave || !file) return;
    const failure = await onUpload({ file, day, pose, notes: notes.trim() || null });
    if (failure) setError(failure);
    else {
      setFile(null);
      setNotes('');
      setError('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('body.photos.addTitle')}</span>
          <p className='Health_card_description'>{t('body.photos.addDescription')}</p>
        </div>
      </div>

      <div className='Diary_Kinds'>
        {PHOTO_POSES.map((option) => (
          <button key={option} type='button' className={option === pose ? 'active' : ''} onClick={() => setPose(option)}>
            {t(`body.poses.${option}`)}
          </button>
        ))}
      </div>

      <div className='Health_Form Body_Photo_Form'>
        <div className='Health_Form_Field'>
          <label htmlFor='photo-day'>{t('body.date')}</label>
          <Global_Input id='photo-day' type='date' value={day} max={today} onChange={(e) => setDay(e.target.value)} />
        </div>
        <div className='Health_Form_Field'>
          <span className='Body_Label'>{t('body.photos.file')}</span>
          <input
            ref={fileRef}
            type='file'
            accept={PHOTO_TYPES.join(',')}
            hidden
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <button type='button' className='Health_see_all Body_File' onClick={() => fileRef.current?.click()}>
            {file ? file.name : t('body.photos.choose')}
          </button>
        </div>
      </div>

      <div className='Health_Form_Field'>
        <label htmlFor='photo-notes'>{t('body.notes')}</label>
        <textarea
          id='photo-notes'
          className='Diary_Text'
          rows={2}
          maxLength={2000}
          value={notes}
          placeholder={t('body.photos.notesPlaceholder')}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className='Health_Form_Error'>{error}</p>}

      <div className='Diary_Actions'>
        <button type='button' className='Health_Form_Save' disabled={!canSave} onClick={() => void handleSave()}>
          {saving ? t('body.photos.uploading') : t('body.photos.upload')}
        </button>
      </div>
    </section>
  );
};

export default Body_Photos_Card;
