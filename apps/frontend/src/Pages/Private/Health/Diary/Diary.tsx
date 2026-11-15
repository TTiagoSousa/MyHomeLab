import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import { useHealthDiary } from '../../../../Hooks/Health/useHealthDiary';
import type { DiaryEntry, DiaryPayload } from '../../../../Hooks/Health/healthTypes';
import Health_Dashboard_Header from '../Shared/Health_Dashboard_Header';
import { dateInput } from '../Shared/healthFormat';
import Diary_Form_Card from './Diary_Form_Card';
import Diary_History from './Diary_History';
import { DEFAULT_FILTERS, matchesFilters, type DiaryFilters } from './diaryFormat';

const Diary = () => {
  const { t } = useTranslation('health');
  const { entries, loading, saving, error, saveEntry, removeEntry } = useHealthDiary();
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [filters, setFilters] = useState<DiaryFilters>(DEFAULT_FILTERS);
  const today = dateInput(new Date());

  const handleSave = async (payload: DiaryPayload, id?: string) => {
    const failure = await saveEntry(payload, id);
    const saved = { ...payload, day: dateInput(new Date(payload.at)) };
    if (!failure && !matchesFilters(saved, filters, today)) setFilters(DEFAULT_FILTERS);
    return failure;
  };

  const handleEdit = (entry: DiaryEntry) => {
    setEditing(entry);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className='Health_Dashboard'>
      <Health_Dashboard_Header title={t('diary.title')} />

      <Diary_Form_Card
        key={editing?.id ?? 'new'}
        editing={editing}
        saving={saving}
        onSave={handleSave}
        onCancel={() => setEditing(null)}
      />

      {error && <div className='Health_empty'>{error}</div>}

      {!loading && !error && (
        <Diary_History
          entries={entries}
          filters={filters}
          today={today}
          onFilters={setFilters}
          onEdit={handleEdit}
          onRemove={(id) => void removeEntry(id)}
        />
      )}
    </div>
  );
};

export default Diary;
