import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const RECORDS = [
  { key: 'profile', path: '/MyHomeLab/Health/Profile' },
  { key: 'labs', path: '/MyHomeLab/Health/Labs' },
  { key: 'medication', path: '/MyHomeLab/Health/Medication' },
  { key: 'diary', path: '/MyHomeLab/Health/Diary' },
  { key: 'nutrition', path: '/MyHomeLab/Health/Nutrition' },
  { key: 'body', path: '/MyHomeLab/Health/Body' },
  { key: 'intakes', path: '/MyHomeLab/Health/Intakes' },
  { key: 'wellbeing', path: '/MyHomeLab/Health/Wellbeing' },
];

const Health_Records_Card = () => {
  const { t } = useTranslation('health');
  const navigate = useNavigate();

  return (
    <section className='Health_Records'>
      {RECORDS.map((record) => (
        <button key={record.key} type='button' className='Health_Record' onClick={() => navigate(record.path)}>
          <span className='Health_Record_Title'>{t(`records.${record.key}.title`)}</span>
          <span className='Health_Record_Text'>{t(`records.${record.key}.text`)}</span>
          <span className='Health_Record_Open'>{t('records.open')} →</span>
        </button>
      ))}
    </section>
  );
};

export default Health_Records_Card;
