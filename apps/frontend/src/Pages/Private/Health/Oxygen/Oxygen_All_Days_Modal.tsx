import { useTranslation } from 'react-i18next';
import { useBloodOxygenDays } from '../../../../Hooks/Health/useBloodOxygenDays';
import Health_Month_Modal from '../Shared/Health_Month_Modal';
import Oxygen_Day_Row from './Oxygen_Day_Row';
import { oxygenColumns } from './oxygenFormat';

interface Oxygen_All_Days_Modal_Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const Oxygen_All_Days_Modal = ({ selectedId, onSelect, onClose }: Oxygen_All_Days_Modal_Props) => {
  const { t } = useTranslation('health');
  const { oxygenDays, loading } = useBloodOxygenDays(0);

  return (
    <Health_Month_Modal
      title={t('oxygen.allDays', { count: oxygenDays.length })}
      description={t('oxygen.allDaysDescription')}
      loading={loading}
      items={oxygenDays}
      tableClass='oxygen'
      columns={oxygenColumns(t)}
      monthOf={(oxygenDay) => oxygenDay.day.slice(0, 7)}
      countLabel={(count) => t('oxygen.days', { count })}
      onClose={onClose}
      renderRow={(oxygenDay) => (
        <Oxygen_Day_Row
          key={oxygenDay.id}
          oxygenDay={oxygenDay}
          selected={oxygenDay.id === selectedId}
          onSelect={() => {
            onSelect(oxygenDay.id);
            onClose();
          }}
        />
      )}
    />
  );
};

export default Oxygen_All_Days_Modal;
