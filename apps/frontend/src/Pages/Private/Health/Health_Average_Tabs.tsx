import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Icon from '../../../Imports/icons';
import Health_Tabs_Filter from './Health_Tabs_Filter';
import { tabLabelKey, type AverageTab } from './averageTabs';

const SCROLL_STEP = 240;

interface Health_Average_Tabs_Props {
  tabs: AverageTab[];
  active: AverageTab;
  saving: boolean;
  onSelect: (tab: AverageTab) => void;
  onSave: (tabs: AverageTab[]) => Promise<string | null>;
}

const Health_Average_Tabs = ({ tabs, active, saving, onSelect, onSave }: Health_Average_Tabs_Props) => {
  const { t } = useTranslation('health');
  const strip = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const [filterOpen, setFilterOpen] = useState(false);

  const measure = () => {
    const element = strip.current;
    if (!element) return;
    setEdges({
      left: element.scrollLeft > 2,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
    });
  };

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [tabs.length]);

  const scroll = (direction: number) => strip.current?.scrollBy({ left: direction * SCROLL_STEP, behavior: 'smooth' });

  return (
    <>
      <div className='Health_Averages_Nav'>
        {edges.left && (
          <button type='button' className='Health_Averages_Arrow left' aria-label={t('averages.tabsPrevious')} onClick={() => scroll(-1)}>
            ‹
          </button>
        )}

        <div className='Health_Averages_Tabs' ref={strip} onScroll={measure}>
          {tabs.map((key) => (
            <button key={key} type='button' className={key === active ? 'active' : ''} onClick={() => onSelect(key)}>
              {t(tabLabelKey(key))}
            </button>
          ))}
        </div>

        {edges.right && (
          <button type='button' className='Health_Averages_Arrow right' aria-label={t('averages.tabsNext')} onClick={() => scroll(1)}>
            ›
          </button>
        )}

        <button
          type='button'
          className={`Health_Averages_Filter_Button${filterOpen ? ' active' : ''}`}
          aria-label={t('averages.tabsFilter')}
          title={t('averages.tabsFilter')}
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen(!filterOpen)}
        >
          <Icon.Settings />
        </button>
      </div>

      {filterOpen && (
        <Health_Tabs_Filter
          current={tabs}
          saving={saving}
          onClose={() => setFilterOpen(false)}
          onSave={async (next) => {
            const failure = await onSave(next);
            if (!failure) setFilterOpen(false);
            return failure;
          }}
        />
      )}
    </>
  );
};

export default Health_Average_Tabs;
