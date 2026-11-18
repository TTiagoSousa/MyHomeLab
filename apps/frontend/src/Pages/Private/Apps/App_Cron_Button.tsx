import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import './App_Settings_Menu.scss';
import * as Icon from '../../../Imports/icons';

const App_Cron_Button = ({ to }: { to: string }) => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();

  return (
    <div className='App_Settings_Menu'>
      <button type='button' className='App_Settings_Menu_button' onClick={() => navigate(to)}>
        <Icon.Clock />
        <span>{t('cronJobs.button')}</span>
      </button>
    </div>
  );
};

export default App_Cron_Button;
