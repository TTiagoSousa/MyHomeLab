import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import './Profile.scss';
import { useHealthProfile } from '../../../../Hooks/Health/useHealthProfile';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import Profile_Form_Card from './Profile_Form_Card';

const Profile = () => {
  const { t } = useTranslation('health');
  const { profile, saving, saveProfile } = useHealthProfile();

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('personal.title')} />

      {profile && <Profile_Form_Card key={JSON.stringify(profile)} profile={profile} saving={saving} onSave={saveProfile} />}
    </div>
  );
};

export default Profile;
