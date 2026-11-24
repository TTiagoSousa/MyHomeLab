import { useTranslation } from 'react-i18next';
import { formatDay } from './Shared/healthFormat';

interface Health_Recent_Values_Props {
  items: { day: string; text: string }[];
}

const Health_Recent_Values = ({ items }: Health_Recent_Values_Props) => {
  const { t } = useTranslation('health');

  return (
    <div className='Health_Recent'>
      <span className='Health_Recent_Title'>{t('averages.recent')}</span>
      <ul className='Health_Recent_List'>
        {items.map((item, index) => (
          <li key={`${item.day}-${index}`} className={index === 0 ? 'latest' : ''}>
            <span>{formatDay(item.day, false)}</span>
            <strong>{item.text}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Health_Recent_Values;
