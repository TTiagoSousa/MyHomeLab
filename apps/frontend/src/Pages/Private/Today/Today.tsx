import { useTranslation } from 'react-i18next';
import Page_Help from '../../../Components/Page_Help/Page_Help';
import './Today.scss';

const Today = () => {
  const { t } = useTranslation('tasks');

  return (
    <div className='Today'>
      <header>
        <div className='Right_Side'>
          <span>{t('today.title')}</span>
          <Page_Help topic='today' />
        </div>
      </header>

      <p className='Today_Empty'>{t('today.empty')}</p>
    </div>
  );
};

export default Today;
