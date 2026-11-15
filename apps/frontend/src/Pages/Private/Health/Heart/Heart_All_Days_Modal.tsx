import { useTranslation } from 'react-i18next';
import { useHeartDays } from '../../../../Hooks/Health/useHeartDays';
import Health_Month_Modal from '../Shared/Health_Month_Modal';
import Heart_Day_Row from './Heart_Day_Row';
import { heartColumns } from './heartFormat';

interface Heart_All_Days_Modal_Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const Heart_All_Days_Modal = ({ selectedId, onSelect, onClose }: Heart_All_Days_Modal_Props) => {
  const { t } = useTranslation('health');
  const { heartDays, loading } = useHeartDays(0);

  return (
    <Health_Month_Modal
      title={t('heart.allDays', { count: heartDays.length })}
      description={t('heart.allDaysDescription')}
      loading={loading}
      items={heartDays}
      tableClass='heart'
      columns={heartColumns(t)}
      monthOf={(heartDay) => heartDay.day.slice(0, 7)}
      countLabel={(count) => t('heart.days', { count })}
      onClose={onClose}
      renderRow={(heartDay) => (
        <Heart_Day_Row
          key={heartDay.id}
          heartDay={heartDay}
          selected={heartDay.id === selectedId}
          onSelect={() => {
            onSelect(heartDay.id);
            onClose();
          }}
        />
      )}
    />
  );
};

export default Heart_All_Days_Modal;
