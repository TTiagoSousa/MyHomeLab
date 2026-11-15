import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Tooltip from '../Tooltip/Tooltip';
import './Page_Help.scss';

interface Page_Help_Props {
  topic: string;
  hint?: string;
}

const Page_Help = ({ topic, hint }: Page_Help_Props) => {
  const { t } = useTranslation('help');
  const text = hint ? `${hint} · ${t('openTopic')}` : t('openTopic');

  return (
    <span className='Page_Help_Wrap'>
      <Tooltip text={text}>
        <Link className='Page_Help' to={`/MyHomeLab/Help?topic=${topic}`} aria-label={text}>
          ?
        </Link>
      </Tooltip>
    </span>
  );
};

export const Page_Intro = ({ page }: { page: 'services' | 'todos' | 'projects' }) => {
  const { t } = useTranslation('nav');
  return <p className='Page_Intro'>{t(`intros.${page}`)}</p>;
};

export default Page_Help;
