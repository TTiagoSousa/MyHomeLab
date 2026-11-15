import { useTranslation } from 'react-i18next';
import type { LabFlag } from '../../../../Hooks/Health/healthTypes';

interface Lab_Flag_Props {
  flag: LabFlag | null;
}

const Lab_Flag = ({ flag }: Lab_Flag_Props) => {
  const { t } = useTranslation('health');
  if (!flag) return <span className='Lab_Flag ok'>{t('labs.flags.ok')}</span>;
  return <span className={`Lab_Flag ${flag.toLowerCase()}`}>{t(`labs.flags.${flag}`)}</span>;
};

export default Lab_Flag;
