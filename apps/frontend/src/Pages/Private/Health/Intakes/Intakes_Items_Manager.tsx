import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IntakeItem, IntakeItemPayload } from '../../../../Hooks/Health/intakesTypes';
import Intakes_Item_Form from './Intakes_Item_Form';
import Intakes_Item_Row from './Intakes_Item_Row';

interface Intakes_Items_Manager_Props {
  items: IntakeItem[];
  saving: boolean;
  onSave: (payload: IntakeItemPayload, id?: string) => Promise<string | null>;
  onRemove: (id: string) => void;
}

const Intakes_Items_Manager = ({ items, saving, onSave, onRemove }: Intakes_Items_Manager_Props) => {
  const { t } = useTranslation('health');
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleRemove = (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId(null);
    onRemove(id);
  };

  return (
    <div className='Intakes_Items'>
      {items.map((item) =>
        editingId === item.id ? (
          <Intakes_Item_Form key={item.id} item={item} saving={saving} onSave={onSave} onCancel={() => setEditingId(null)} />
        ) : (
          <Intakes_Item_Row
            key={item.id}
            item={item}
            confirming={confirmId === item.id}
            onEdit={() => setEditingId(item.id)}
            onRemove={handleRemove}
            onCancelRemove={() => setConfirmId(null)}
          />
        ),
      )}

      {!items.length && editingId !== 'new' && <span className='Health_chart_empty'>{t('intakes.items.empty')}</span>}

      {editingId === 'new' ? (
        <Intakes_Item_Form key='new' item={null} saving={saving} onSave={onSave} onCancel={() => setEditingId(null)} />
      ) : (
        <div className='Diary_Actions'>
          <button type='button' className='Health_see_all' onClick={() => setEditingId('new')}>
            + {t('intakes.items.add')}
          </button>
        </div>
      )}
    </div>
  );
};

export default Intakes_Items_Manager;
