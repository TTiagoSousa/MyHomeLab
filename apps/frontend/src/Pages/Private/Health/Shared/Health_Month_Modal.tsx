import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Health_Table_Head, { type Health_Table_Column } from './Health_Table_Head';
import { monthLabel } from './healthFormat';

interface Health_Month_Modal_Props<Item> {
  title: string;
  description: string;
  loading: boolean;
  items: Item[];
  tableClass: string;
  columns: Health_Table_Column[];
  monthOf: (item: Item) => string;
  countLabel: (count: number) => string;
  renderRow: (item: Item) => ReactNode;
  onClose: () => void;
}

const groupByMonth = <Item,>(items: Item[], monthOf: (item: Item) => string) => {
  const groups: { month: string; items: Item[] }[] = [];
  for (const item of items) {
    const month = monthOf(item);
    const group = groups[groups.length - 1];
    if (group?.month === month) group.items.push(item);
    else groups.push({ month, items: [item] });
  }
  return groups;
};

const Health_Month_Modal = <Item,>({
  title,
  description,
  loading,
  items,
  tableClass,
  columns,
  monthOf,
  countLabel,
  renderRow,
  onClose,
}: Health_Month_Modal_Props<Item>) => {
  const { t } = useTranslation('health');

  return (
    <div className='Health_Month_Modal_Overlay' onClick={onClose}>
      <div className='Health_Month_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Health_card_head'>
          <div>
            <span className='Health_card_title'>{title}</span>
            <p className='Health_card_description'>{description}</p>
          </div>
          <button type='button' className='Health_see_all' onClick={onClose}>
            {t('import.close')}
          </button>
        </div>

        {loading && !items.length && <span className='Health_card_description'>{t('loading')}</span>}

        <div className={`Health_Table ${tableClass}`}>
          <Health_Table_Head columns={columns} />
          <div className='Health_Table_Body'>
            {groupByMonth(items, monthOf).map((group) => (
              <section key={group.month}>
                <span className='Health_Table_Month'>
                  {monthLabel(group.month)} · {countLabel(group.items.length)}
                </span>
                {group.items.map(renderRow)}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Health_Month_Modal;
