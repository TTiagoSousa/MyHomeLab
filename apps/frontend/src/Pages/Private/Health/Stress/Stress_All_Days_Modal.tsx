import { useTranslation } from 'react-i18next';
import { useStressDays } from '../../../../Hooks/Health/useStressDays';
import Health_Month_Modal from '../Shared/Health_Month_Modal';
import Stress_Day_Row from './Stress_Day_Row';
import { stressColumns } from './stressFormat';

interface Stress_All_Days_Modal_Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const Stress_All_Days_Modal = ({ selectedId, onSelect, onClose }: Stress_All_Days_Modal_Props) => {
  const { t } = useTranslation('health');
  const { stressDays, loading } = useStressDays(0);

  return (
    <Health_Month_Modal
      title={t('stress.allDays', { count: stressDays.length })}
      description={t('stress.allDaysDescription')}
      loading={loading}
      items={stressDays}
      tableClass='stress'
      columns={stressColumns(t)}
      monthOf={(stressDay) => stressDay.day.slice(0, 7)}
      countLabel={(count) => t('stress.days', { count })}
      onClose={onClose}
      renderRow={(stressDay) => (
        <Stress_Day_Row
          key={stressDay.id}
          stressDay={stressDay}
          selected={stressDay.id === selectedId}
          onSelect={() => {
            onSelect(stressDay.id);
            onClose();
          }}
        />
      )}
    />
  );
};

export default Stress_All_Days_Modal;
