import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Health.scss';
import { useHealthSummary } from '../../../Hooks/Health/useHealthSummary';
import Health_Averages_Card from './Health_Averages_Card';
import Health_Records_Card from './Health_Records_Card';
import Health_Import_Modal from '../../../Components/Modals/Health_Import_Modal/Health_Import_Modal';
import * as Icon from '../../../Imports/icons';

const Health = () => {
  const { t } = useTranslation('health');
  const { summary, loading, error, fetchSummary } = useHealthSummary();
  const [importOpen, setImportOpen] = useState(false);

  return (
    <div className='Health'>
      <header>
        <div className='Right_Side'>
          <span>{t('page.title')}</span>
        </div>

        <div className='Left_Side'>
          <button type='button' className='Health_add' onClick={() => setImportOpen(true)}>
            <Icon.Plus />
            <span>{t('page.addData')}</span>
          </button>
        </div>
      </header>

      {error && <div className='Health_empty'>{error}</div>}

      {!loading && !error && !summary?.sleep && !summary?.heart && !summary?.skinTemperature && !summary?.bloodOxygen && !summary?.stress && !summary?.steps && !summary?.exercise && (
        <div className='Health_empty'>
          <span className='Health_empty_title'>{t('empty.title')}</span>
          <span>{t('empty.text')}</span>
          <button type='button' className='Health_add' onClick={() => setImportOpen(true)}>
            <Icon.Plus />
            <span>{t('page.addData')}</span>
          </button>
        </div>
      )}

      {summary && <Health_Averages_Card summary={summary} />}

      <Health_Records_Card />

      {importOpen && <Health_Import_Modal onClose={() => setImportOpen(false)} onImported={fetchSummary} />}
    </div>
  );
};

export default Health;
