import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../../../../Hooks/Health/healthTypes';
import Health_Stat from '../Shared/Health_Stat';
import { formatDay } from '../Shared/healthFormat';
import Diary_Entry_Item from './Diary_Entry_Item';
import Diary_Filters from './Diary_Filters';
import { allergyContext, filterEntries, groupByDay, topTriggers, type DiaryFilters } from './diaryFormat';

interface Diary_History_Props {
  entries: DiaryEntry[];
  filters: DiaryFilters;
  today: string;
  onFilters: (filters: DiaryFilters) => void;
  onEdit: (entry: DiaryEntry) => void;
  onRemove: (id: string) => void;
}

const Diary_History = ({ entries, filters, today, onFilters, onEdit, onRemove }: Diary_History_Props) => {
  const { t } = useTranslation('health');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const visible = filterEntries(entries, filters, today);
  const triggers = topTriggers(visible);

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
          <span className='Health_card_title'>{t('diary.historyTitle')}</span>
          <p className='Health_card_description'>{t('diary.historyDescription')}</p>
        </div>
      </div>

      <Diary_Filters filters={filters} today={today} onChange={onFilters} />

      <div className='Health_Stats columns-4'>
        <Health_Stat highlight label={t('diary.stats.entries')} value={String(visible.length)} />
        <Health_Stat label={t('diary.stats.pains')} value={String(visible.filter((entry) => entry.kind === 'PAIN').length)} />
        <Health_Stat label={t('diary.stats.allergies')} value={String(visible.filter((entry) => entry.kind === 'ALLERGY').length)} />
        <Health_Stat
          label={t('diary.stats.topTrigger')}
          value={triggers[0]?.label ?? '—'}
          sub={triggers.length ? triggers.map((item) => `${item.label} ×${item.count}`).join(' · ') : undefined}
        />
      </div>

      {!entries.length ? (
        <span className='Health_chart_empty'>{t('diary.emptyText')}</span>
      ) : !visible.length ? (
        <div className='Health_empty'>
          <span className='Health_empty_title'>{t('diary.noMatchTitle')}</span>
          <span>{t('diary.noMatchText')}</span>
        </div>
      ) : (
        <div className='Diary_Days'>
          {groupByDay(visible).map((group) => (
            <div key={group.day} className='Diary_Day'>
              <span className='Diary_Day_Label'>{formatDay(group.day)}</span>
              {group.entries.map((entry) => (
                <Diary_Entry_Item
                  key={entry.id}
                  entry={entry}
                  context={entry.kind === 'ALLERGY' ? allergyContext(entries, entry) : []}
                  confirming={confirmId === entry.id}
                  onEdit={onEdit}
                  onRemove={handleRemove}
                  onCancelRemove={() => setConfirmId(null)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default Diary_History;
