import { useTranslation } from 'react-i18next';
import type { IntakeDay, IntakeEntry, IntakePayload } from '../../../../Hooks/Health/intakesTypes';
import { formatDay } from '../Shared/healthFormat';
import Intakes_Entry_Form from './Intakes_Entry_Form';
import Intakes_Entry_Row from './Intakes_Entry_Row';
import { formatDrinks, formatNumber } from './intakesFormat';

interface Intakes_History_Day_Props {
  day: string;
  open: boolean;
  summary: IntakeDay | null;
  entries: IntakeEntry[];
  itemIds: string[];
  confirmId: string | null;
  editingId: string | null;
  saving: boolean;
  onToggle: () => void;
  onEdit: (id: string | null) => void;
  onSave: (payload: IntakePayload, id?: string) => Promise<string | null>;
  onRemove: (id: string) => void;
  onCancelRemove: () => void;
}

const Intakes_History_Day = ({
  day,
  open,
  summary,
  entries,
  itemIds,
  confirmId,
  editingId,
  saving,
  onToggle,
  onEdit,
  onSave,
  onRemove,
  onCancelRemove,
}: Intakes_History_Day_Props) => {
  const { t } = useTranslation('health');
  const totals = [
    summary && summary.caffeineMg > 0 ? `${formatNumber(summary.caffeineMg, 0)} mg` : null,
    summary && summary.drinks > 0 ? formatDrinks(t, summary.drinks) : null,
  ].filter(Boolean);

  return (
    <div className={`Intakes_History_Day${open ? ' open' : ''}`}>
      <button type='button' className='Intakes_Day_Head' aria-expanded={open} onClick={onToggle}>
        <span className='Intakes_Day_Chevron' aria-hidden='true'>
          ›
        </span>
        <span className='Intakes_Day_Date'>{formatDay(day)}</span>
        <span className='Intakes_Day_Count'>{t('intakes.history.entries', { count: entries.length })}</span>
        {totals.length > 0 && <span className='Intakes_Day_Totals'>{totals.join(' · ')}</span>}
      </button>

      {open && (
        <div className='Intakes_Day_Entries'>
          {entries.map((entry) =>
            editingId === entry.id ? (
              <Intakes_Entry_Form
                key={entry.id}
                entry={entry}
                itemIds={itemIds}
                saving={saving}
                onSave={onSave}
                onCancel={() => onEdit(null)}
              />
            ) : (
              <Intakes_Entry_Row
                key={entry.id}
                entry={entry}
                confirming={confirmId === entry.id}
                onEdit={() => onEdit(entry.id)}
                onRemove={onRemove}
                onCancelRemove={onCancelRemove}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
};

export default Intakes_History_Day;
