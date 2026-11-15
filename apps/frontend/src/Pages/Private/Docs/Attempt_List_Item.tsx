import { useTranslation } from 'react-i18next';
import type { UpdateAttemptSummary } from '../../../Hooks/Updates/updateAttemptTypes';
import { formatRelativeTime } from '../Apps/relativeTime';
import { attemptStatus, attemptTitle } from '../../../Hooks/Updates/attemptLabels';

interface Attempt_List_Item_Props {
  attempt: UpdateAttemptSummary;
  onSelect: () => void;
}

const Attempt_List_Item = ({ attempt, onSelect }: Attempt_List_Item_Props) => {
  const { t } = useTranslation('docs');
  const { counts } = attempt;

  return (
    <button type='button' className='Doc_List_Item' onClick={onSelect}>
      <span className='Doc_List_Item_Title'>{attemptTitle(attempt, t)}</span>
      <span className='Doc_List_Item_Chips'>
        <span className='Doc_Chip kind attempt'>{t('kinds.ATTEMPT')}</span>
        <span className={`Doc_Chip attempt_status ${attempt.status.toLowerCase()}`}>{attemptStatus(attempt, t)}</span>
      </span>
      <span className='Doc_List_Item_Snippet'>
        {t('attempts.counts', { validated: counts.validated + counts.notApplicable + (counts.skipped ?? 0), total: counts.total })}
        {counts.notValidated > 0 && ` · ${t('attempts.countsFailed', { count: counts.notValidated })}`}
      </span>
      <span className='Doc_List_Item_Meta'>{formatRelativeTime(attempt.updatedAt, t)}</span>
    </button>
  );
};

export default Attempt_List_Item;
