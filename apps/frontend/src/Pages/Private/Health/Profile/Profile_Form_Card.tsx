import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import type { HealthProfile, HealthProfileFields, Sex } from '../../../../Hooks/Health/healthTypes';
import { dateInput } from '../Shared/healthFormat';

const SEXES: Sex[] = ['MALE', 'FEMALE', 'OTHER'];
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

interface Profile_Form_Card_Props {
  profile: HealthProfile;
  saving: boolean;
  onSave: (fields: Partial<HealthProfileFields>) => Promise<string | null>;
}

const Profile_Form_Card = ({ profile, saving, onSave }: Profile_Form_Card_Props) => {
  const { t } = useTranslation('health');
  const [fullName, setFullName] = useState(profile.fullName ?? '');
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? '');
  const [sex, setSex] = useState(profile.sex ?? '');
  const [bloodType, setBloodType] = useState(profile.bloodType ?? '');
  const [height, setHeight] = useState(profile.heightCm != null ? String(profile.heightCm) : '');
  const [emergencyContact, setEmergencyContact] = useState(profile.emergencyContact ?? '');
  const [notes, setNotes] = useState(profile.notes ?? '');
  const [error, setError] = useState('');

  const heightCm = Number(height.replace(',', '.'));
  const heightValid = height.trim() === '' || (heightCm >= 50 && heightCm <= 250);
  const canSave = !saving && heightValid;

  const handleSave = async () => {
    if (!canSave) return;
    const failure = await onSave({
      fullName: fullName.trim() || null,
      birthDate: birthDate || null,
      sex: (sex || null) as Sex | null,
      bloodType: bloodType || null,
      heightCm: height.trim() ? Math.round(heightCm * 10) / 10 : null,
      emergencyContact: emergencyContact.trim() || null,
      notes: notes.trim() || null,
    });
    setError(failure ?? '');
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('personal.formTitle')}</span>
          <p className='Health_card_description'>{t('personal.formDescription')}</p>
        </div>
      </div>

      <div className='Health_Form profile'>
        <div className='Health_Form_Field wide'>
          <label htmlFor='profile-name'>{t('personal.fullName')}</label>
          <Global_Input id='profile-name' value={fullName} maxLength={120} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className='Health_Form_Field'>
          <label htmlFor='profile-birth'>{t('personal.birthDate')}</label>
          <Global_Input
            id='profile-birth'
            type='date'
            value={birthDate}
            max={dateInput(new Date())}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>
        <div className='Health_Form_Field'>
          <label htmlFor='profile-sex'>{t('personal.sex')}</label>
          <Global_Dropdown
            id='profile-sex'
            value={sex}
            onChange={setSex}
            placeholder={t('personal.choose')}
            options={SEXES.map((option) => ({ value: option, label: t(`personal.sexes.${option}`) }))}
          />
        </div>
        <div className='Health_Form_Field'>
          <label htmlFor='profile-blood'>{t('personal.bloodType')}</label>
          <Global_Dropdown
            id='profile-blood'
            value={bloodType}
            onChange={setBloodType}
            placeholder={t('personal.choose')}
            options={BLOOD_TYPES.map((option) => ({ value: option, label: option }))}
          />
        </div>
        <div className='Health_Form_Field'>
          <label htmlFor='profile-height'>{t('profile.height')}</label>
          <Global_Input id='profile-height' value={height} placeholder='178' onChange={(e) => setHeight(e.target.value)} />
        </div>
        <div className='Health_Form_Field wide'>
          <label htmlFor='profile-emergency'>{t('personal.emergencyContact')}</label>
          <Global_Input
            id='profile-emergency'
            value={emergencyContact}
            maxLength={200}
            placeholder={t('personal.emergencyPlaceholder')}
            onChange={(e) => setEmergencyContact(e.target.value)}
          />
        </div>
      </div>

      <div className='Health_Form_Field'>
        <label htmlFor='profile-notes'>{t('personal.notes')}</label>
        <textarea
          id='profile-notes'
          className='Diary_Text'
          rows={2}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {!heightValid && <p className='Health_Form_Error'>{t('personal.heightInvalid')}</p>}
      {error && <p className='Health_Form_Error'>{error}</p>}

      <div className='Diary_Actions'>
        <button type='button' className='Health_Form_Save' disabled={!canSave} onClick={() => void handleSave()}>
          {saving ? t('diary.saving') : t('profile.save')}
        </button>
      </div>
    </section>
  );
};

export default Profile_Form_Card;
