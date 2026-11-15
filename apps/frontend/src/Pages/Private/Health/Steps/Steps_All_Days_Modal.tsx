import { useTranslation } from 'react-i18next';
import { useSteps } from '../../../../Hooks/Health/useSteps';
import Health_Month_Modal from '../Shared/Health_Month_Modal';
import Steps_Day_Row from './Steps_Day_Row';
import { stepsColumns } from './stepsFormat';

interface Steps_All_Days_Modal_Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const Steps_All_Days_Modal = ({ selectedId, onSelect, onClose }: Steps_All_Days_Modal_Props) => {
  const { t } = useTranslation('health');
  const { stepsDays, loading } = useSteps(0);

  return (
    <Health_Month_Modal
      title={t('steps.allDays', { count: stepsDays.length })}
      description={t('steps.allDaysDescription')}
      loading={loading}
      items={stepsDays}
      tableClass='steps'
      columns={stepsColumns(t)}
      monthOf={(stepsDay) => stepsDay.day.slice(0, 7)}
      countLabel={(count) => t('steps.days', { count })}
      onClose={onClose}
      renderRow={(stepsDay) => (
        <Steps_Day_Row
          key={stepsDay.id}
          stepsDay={stepsDay}
          selected={stepsDay.id === selectedId}
          onSelect={() => {
            onSelect(stepsDay.id);
            onClose();
          }}
        />
      )}
    />
  );
};

export default Steps_All_Days_Modal;
