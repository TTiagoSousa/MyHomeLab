import { useTranslation } from 'react-i18next';
import { useSleepNights } from '../../../../Hooks/Health/useSleepNights';
import Health_Month_Modal from '../Shared/Health_Month_Modal';
import Sleep_Night_Row from './Sleep_Night_Row';
import { sleepColumns } from './sleepFormat';

interface Sleep_All_Nights_Modal_Props {
  selectedId: string | null;
  showNaps: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const Sleep_All_Nights_Modal = ({ selectedId, showNaps, onSelect, onClose }: Sleep_All_Nights_Modal_Props) => {
  const { t } = useTranslation('health');
  const { sessions, loading } = useSleepNights(0);
  const visible = sessions.filter((session) => showNaps || !session.isNap);

  return (
    <Health_Month_Modal
      title={t('sleep.allNights', { count: visible.length })}
      description={t('sleep.allNightsDescription')}
      loading={loading}
      items={visible}
      tableClass='sleep'
      columns={sleepColumns(t)}
      monthOf={(session) => session.night.slice(0, 7)}
      countLabel={(count) => t('sleep.nights', { count })}
      onClose={onClose}
      renderRow={(session) => (
        <Sleep_Night_Row
          key={session.id}
          session={session}
          selected={session.id === selectedId}
          onSelect={() => {
            onSelect(session.id);
            onClose();
          }}
        />
      )}
    />
  );
};

export default Sleep_All_Nights_Modal;
