import { useTranslation } from 'react-i18next';
import type { LabResult } from '../../../../Hooks/Health/healthTypes';
import Lab_Parameter_Row from './Lab_Parameter_Row';
import { groupByCategory } from './labCategories';

interface Lab_Categories_Props<Result extends LabResult> {
  results: Result[];
  onOpen: (key: string) => void;
}

const Lab_Categories = <Result extends LabResult>({ results, onOpen }: Lab_Categories_Props<Result>) => {
  const { t } = useTranslation('health');

  return (
    <div className='Lab_Categories'>
      {groupByCategory(results).map(({ category, items }) => {
        const out = items.filter((item) => item.result.flag).length;
        return (
          <section key={category} className='Health_card Lab_Category'>
            <div className='Health_card_head'>
              <div>
                <span className='Health_card_title'>{t(`labs.categories.${category}`)}</span>
                <p className='Health_card_description'>
                  {t('labs.categoryCount', { count: items.length })}
                  {out > 0 && <span className='Lab_Out'> · {t('labs.outCount', { count: out })}</span>}
                </p>
              </div>
            </div>
            <div className='Lab_Rows'>
              {items.map(({ result, percent }) => (
                <Lab_Parameter_Row key={result.key} result={result} percent={percent} onOpen={onOpen} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default Lab_Categories;
