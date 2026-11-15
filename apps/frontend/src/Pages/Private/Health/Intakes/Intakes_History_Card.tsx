import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IntakeDay, IntakeEntry, IntakeKind, IntakePayload } from '../../../../Hooks/Health/intakesTypes';
import Intakes_History_Day from './Intakes_History_Day';
import { entriesByDay, INTAKE_KINDS } from './intakesFormat';

interface Intakes_History_Card_Props {
  entries: IntakeEntry[];
  days: IntakeDay[];
  itemIds: string[];
  saving: boolean;
  onSave: (payload: IntakePayload, id?: string) => Promise<string | null>;
  onRemove: (id: string) => void;
}

const DAYS_PER_PAGE = 7;

const Intakes_History_Card = ({ entries, days, itemIds, saving, onSave, onRemove }: Intakes_History_Card_Props) => {
  const { t } = useTranslation('health');
  const [kind, setKind] = useState<IntakeKind | 'ALL'>('ALL');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [visibleDays, setVisibleDays] = useState(DAYS_PER_PAGE);
  const filtered = kind === 'ALL' ? entries : entries.filter((entry) => entry.kind === kind);
  const grouped = entriesByDay(filtered);
  const dayKeys = [...grouped.keys()].sort((a, b) => b.localeCompare(a));
  const [openDays, setOpenDays] = useState<string[]>(dayKeys.slice(0, 1));
  const visible = dayKeys.slice(0, visibleDays);
  const allOpen = visible.length > 0 && visible.every((day) => openDays.includes(day));

  const toggleDay = (day: string) =>
    setOpenDays(openDays.includes(day) ? openDays.filter((item) => item !== day) : [...openDays, day]);

  const handleRemove = (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId(null);
    onRemove(id);
  };

  return (
    <section className='Health_card'>
      <div className='Health_card_head'>
        <div>
          <span className='Health_card_title'>{t('intakes.history.title', { count: entries.length })}</span>
          <p className='Health_card_description'>{t('intakes.history.description')}</p>
        </div>
        {visible.length > 1 && (
          <button type='button' className='Health_see_all' onClick={() => setOpenDays(allOpen ? [] : visible)}>
            {allOpen ? t('intakes.history.collapseAll') : t('intakes.history.expandAll')}
          </button>
        )}
      </div>

      {entries.length > 0 && (
        <div className='Diary_Kinds Intakes_History_Filter'>
          {(['ALL', ...INTAKE_KINDS] as const).map((option) => (
            <button key={option} type='button' className={option === kind ? 'active' : ''} onClick={() => setKind(option)}>
              {option === 'ALL' ? t('intakes.history.all') : t(`intakes.kinds.${option}`)}
            </button>
          ))}
        </div>
      )}

      {dayKeys.length ? (
        <div className='Intakes_History_Days'>
          {visible.map((day) => (
            <Intakes_History_Day
              key={day}
              day={day}
              open={openDays.includes(day)}
              summary={kind === 'ALL' ? (days.find((item) => item.day === day) ?? null) : null}
              entries={grouped.get(day) ?? []}
              itemIds={itemIds}
              confirmId={confirmId}
              editingId={editingId}
              saving={saving}
              onToggle={() => toggleDay(day)}
              onEdit={setEditingId}
              onSave={onSave}
              onRemove={handleRemove}
              onCancelRemove={() => setConfirmId(null)}
            />
          ))}
        </div>
      ) : (
        <span className='Health_chart_empty'>{entries.length ? t('intakes.history.emptyKind') : t('intakes.history.empty')}</span>
      )}

      {dayKeys.length > visibleDays && (
        <button type='button' className='Health_see_all Intakes_History_More' onClick={() => setVisibleDays(visibleDays + DAYS_PER_PAGE)}>
          {t('intakes.history.moreDays', { count: Math.min(DAYS_PER_PAGE, dayKeys.length - visibleDays) })}
        </button>
      )}
    </section>
  );
};

export default Intakes_History_Card;
