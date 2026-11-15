import { useTranslation } from 'react-i18next';
import { useSkinTemperatureDays } from '../../../../Hooks/Health/useSkinTemperatureDays';
import Health_Month_Modal from '../Shared/Health_Month_Modal';
import Skin_Day_Row from './Skin_Day_Row';
import { skinColumns } from './skinFormat';

interface Skin_All_Days_Modal_Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const Skin_All_Days_Modal = ({ selectedId, onSelect, onClose }: Skin_All_Days_Modal_Props) => {
  const { t } = useTranslation('health');
  const { temperatureDays, loading } = useSkinTemperatureDays(0);

  return (
    <Health_Month_Modal
      title={t('skin.allDays', { count: temperatureDays.length })}
      description={t('skin.allDaysDescription')}
      loading={loading}
      items={temperatureDays}
      tableClass='skin'
      columns={skinColumns(t)}
      monthOf={(temperatureDay) => temperatureDay.day.slice(0, 7)}
      countLabel={(count) => t('skin.days', { count })}
      onClose={onClose}
      renderRow={(temperatureDay) => (
        <Skin_Day_Row
          key={temperatureDay.id}
          temperatureDay={temperatureDay}
          selected={temperatureDay.id === selectedId}
          onSelect={() => {
            onSelect(temperatureDay.id);
            onClose();
          }}
        />
      )}
    />
  );
};

export default Skin_All_Days_Modal;
