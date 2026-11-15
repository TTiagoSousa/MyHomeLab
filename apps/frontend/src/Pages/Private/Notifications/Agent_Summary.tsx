import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import { useAgentSummary } from '../../../Hooks/Schedules/useAgentSummary';

interface Props {
  day: string;
  initialMessage: string;
}

const Agent_Summary = ({ day, initialMessage }: Props) => {
  const { t } = useTranslation('notifications');
  const { message, loading, fetchSummary } = useAgentSummary(initialMessage, day);
  const [from, setFrom] = useState(day);
  const [to, setTo] = useState(day);

  const changeFrom = (value: string) => {
    setFrom(value);
    void fetchSummary(value, to);
  };

  const changeTo = (value: string) => {
    setTo(value);
    void fetchSummary(from, value);
  };

  return (
    <div className='Agent_Summary'>
      <div className='Agent_Summary_dates'>
        <label>
          <span>{t('summaryFrom')}</span>
          <Global_Input type='date' value={from} onChange={(e) => changeFrom(e.target.value)} />
        </label>
        <label>
          <span>{t('summaryTo')}</span>
          <Global_Input type='date' value={to} onChange={(e) => changeTo(e.target.value)} />
        </label>
      </div>
      <span className='Notifications_message'>
        {loading ? t('summaryLoading') : message || t('summaryEmpty')}
      </span>
    </div>
  );
};

export default Agent_Summary;
