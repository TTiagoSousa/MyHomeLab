import { useTranslation } from 'react-i18next';
import type { OpenGymStatus } from '../../../Hooks/Health/healthTypes';

interface Health_OpenGym_Status_Props {
  status: OpenGymStatus | null;
}

const Health_OpenGym_Status = ({ status }: Health_OpenGym_Status_Props) => {
  const { t } = useTranslation('health');
  const state = !status ? 'checking' : status.online ? 'online' : 'offline';

  return (
    <em className={`Health_OpenGym_Status ${state}`} title={status?.error ?? undefined}>
      <i />
      {t(`import.openGym.status.${state}`)}
    </em>
  );
};

export default Health_OpenGym_Status;
