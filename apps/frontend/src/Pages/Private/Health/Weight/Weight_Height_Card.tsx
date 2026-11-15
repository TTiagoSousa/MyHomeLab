import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import { useHealthProfile } from '../../../../Hooks/Health/useHealthProfile';
import Health_Stat from '../Shared/Health_Stat';

interface Weight_Height_Card_Props {
  refreshKey: number;
}

const bmiCategory = (bmi: number) => {
  if (bmi < 18.5) return 'under';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'over';
  return 'obese';
};

const Weight_Height_Card = ({ refreshKey }: Weight_Height_Card_Props) => {
  const { t } = useTranslation('health');
  const { profile, saving, saveProfile } = useHealthProfile(refreshKey);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const height = draft ?? (profile?.heightCm != null ? String(profile.heightCm) : '');
  const heightCm = Number(height.replace(',', '.'));
  const canSave = !saving && height.trim() !== '' && heightCm >= 50 && heightCm <= 250;

  const handleSave = async () => {
    if (!canSave) return;
    const failure = await saveProfile({ heightCm: Math.round(heightCm * 10) / 10 });
    if (failure) setError(failure);
    else {
      setError('');
      setDraft(null);
    }
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('profile.title')}</span>
          <p className='Health_card_description'>{t('profile.description')}</p>
        </div>
      </div>

      <div className='Weight_Profile'>
        <div className='Health_Form_Field'>
          <label htmlFor='profile-height'>{t('profile.height')}</label>
          <div className='Weight_Profile_Input'>
            <Global_Input
              id='profile-height'
              value={height}
              placeholder='178'
              onChange={(e) => {
                setDraft(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSave();
              }}
            />
            <button type='button' className='Health_Form_Save' disabled={!canSave} onClick={() => void handleSave()}>
              {t('profile.save')}
            </button>
          </div>
        </div>
        <Health_Stat
          highlight
          label={t('profile.bmi')}
          value={profile?.bmi != null ? String(profile.bmi) : '—'}
          sub={profile?.bmi != null ? t(`profile.bmiCategories.${bmiCategory(profile.bmi)}`) : t('profile.bmiMissing')}
        />
      </div>

      {error && <p className='Health_Form_Error'>{error}</p>}
    </section>
  );
};

export default Weight_Height_Card;
