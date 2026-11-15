import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import { useLabs } from '../../../../Hooks/Health/useLabs';
import { useLabEditor } from '../../../../Hooks/Health/useLabEditor';
import Lab_Report_Modal, { type Lab_Report_Initial } from '../../../../Components/Modals/Lab_Report_Modal/Lab_Report_Modal';
import Lab_Reports_Panel from './Lab_Reports_Panel';
import Lab_Summary_Card from './Lab_Summary_Card';
import Lab_Categories from './Lab_Categories';
import Lab_Parameter_Modal from './Lab_Parameter_Modal';

interface Editor {
  initial: Lab_Report_Initial;
  source: 'PDF' | 'MANUAL';
  file: File | null;
}

const EMPTY: Lab_Report_Initial = { collectedAt: null, lab: null, notes: null, results: [] };

const Labs = () => {
  const { t } = useTranslation('health');
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const { reports, parameters, loading, error } = useLabs();
  const { extracting, extract } = useLabEditor();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [extractError, setExtractError] = useState('');
  const [parameterKey, setParameterKey] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setExtractError('');
    const { draft, error: failure } = await extract(file);
    if (fileRef.current) fileRef.current.value = '';
    if (!draft) {
      setExtractError(failure ?? '');
      return;
    }
    setEditor({ initial: { ...draft, notes: null }, source: 'PDF', file });
  };

  return (
    <div className='Health_Dashboard'>
      <header>
        <div className='Right_Side'>
          <button type='button' className='Health_back' onClick={() => navigate('/MyHomeLab/Health')}>
            ← {t('page.title')}
          </button>
          <span>{t('labs.title')}</span>
        </div>
        <div className='Left_Side'>
          <input
            ref={fileRef}
            type='file'
            accept='application/pdf'
            hidden
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <button type='button' className='Health_see_all' disabled={extracting} onClick={() => fileRef.current?.click()}>
            {t('labs.uploadPdf')}
          </button>
          <button
            type='button'
            className='Health_see_all'
            disabled={extracting}
            onClick={() => setEditor({ initial: EMPTY, source: 'MANUAL', file: null })}
          >
            {t('labs.addManual')}
          </button>
        </div>
      </header>

      {extracting && (
        <section className='Health_card Lab_Reading'>
          <span className='Health_card_title'>{t('labs.reading.title')}</span>
          <p className='Health_card_description'>{t('labs.reading.text')}</p>
        </section>
      )}

      {extractError && <div className='Health_empty'>{extractError}</div>}
      {error && <div className='Health_empty'>{error}</div>}

      {!loading && !error && !reports.length && !extracting && (
        <div className='Health_empty'>
          <span className='Health_empty_title'>{t('labs.emptyTitle')}</span>
          <span>{t('labs.emptyText')}</span>
        </div>
      )}

      {reports.length > 0 && <Lab_Summary_Card reports={reports} parameters={parameters} onOpen={setParameterKey} />}

      {parameters.length > 0 && <Lab_Categories results={parameters} onOpen={setParameterKey} />}

      {reports.length > 0 && <Lab_Reports_Panel reports={reports} />}

      {editor && (
        <Lab_Report_Modal
          initial={editor.initial}
          source={editor.source}
          file={editor.file}
          onClose={() => setEditor(null)}
          onSaved={(id) => navigate(`/MyHomeLab/Health/Labs/${id}`)}
        />
      )}

      {parameterKey && <Lab_Parameter_Modal parameterKey={parameterKey} onClose={() => setParameterKey(null)} />}
    </div>
  );
};

export default Labs;
