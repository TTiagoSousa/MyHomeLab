import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Global_Input from '../../../../Components/Inputs/Global_Input/Global_Input';
import type { Fast, FastPayload } from '../../../../Hooks/Health/healthLogTypes';
import Fasting_Form from './Fasting_Form';
import Fasting_Record_Row from './Fasting_Record_Row';
import { FAST_FILTERS, filterFasts, type FastFilter } from './fastingFormat';

interface Fasting_Records_Card_Props {
  fasts: Fast[];
  defaultTarget: number;
  saving: boolean;
  onSave: (payload: FastPayload, id?: string) => Promise<string | null>;
  onRemove: (id: string) => void;
}

const Fasting_Records_Card = ({ fasts, defaultTarget, saving, onSave, onRemove }: Fasting_Records_Card_Props) => {
  const { t } = useTranslation('health');
  const [filter, setFilter] = useState<FastFilter>('all');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const visible = filterFasts(fasts, filter, search);

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
          <span className='Health_card_title'>{t('fasting.records.title')}</span>
          <p className='Health_card_description'>{t('fasting.records.description')}</p>
        </div>
        {fasts.length > 0 && <span className='Fasting_Records_Count'>{t('fasting.records.count', { count: visible.length })}</span>}
      </div>

      {!fasts.length ? (
        <span className='Health_chart_empty'>{t('fasting.records.empty')}</span>
      ) : (
        <>
          <div className='Diary_Filters'>
            <div className='Diary_Filters_Row'>
              <div className='Diary_Kinds'>
                {FAST_FILTERS.map((option) => (
                  <button key={option} type='button' className={filter === option ? 'active' : ''} onClick={() => setFilter(option)}>
                    {t(`fasting.records.filters.${option}`)}
                  </button>
                ))}
              </div>
              <div className='Diary_Filters_Search'>
                <Global_Input value={search} placeholder={t('fasting.records.searchPlaceholder')} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </div>

          {visible.length ? (
            <div className='Fasting_Records'>
              {visible.map((fast) =>
                fast.id === editingId ? (
                  <Fasting_Form
                    key={fast.id}
                    mode='edit'
                    fast={fast}
                    defaultTarget={defaultTarget}
                    saving={saving}
                    onSave={(payload) => onSave(payload, fast.id)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <Fasting_Record_Row
                    key={fast.id}
                    fast={fast}
                    confirming={confirmId === fast.id}
                    onEdit={() => setEditingId(fast.id)}
                    onRemove={() => handleRemove(fast.id)}
                    onCancelRemove={() => setConfirmId(null)}
                  />
                ),
              )}
            </div>
          ) : (
            <span className='Health_chart_empty'>{t('fasting.records.noMatch')}</span>
          )}
        </>
      )}
    </section>
  );
};

export default Fasting_Records_Card;
