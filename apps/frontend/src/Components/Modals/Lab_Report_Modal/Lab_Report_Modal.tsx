import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Lab_Report_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import { useLabEditor } from '../../../Hooks/Health/useLabEditor';
import type { LabResult } from '../../../Hooks/Health/healthTypes';
import {
  formatLabReference,
  parseLabReference,
  parseLabValue,
  valueInput,
} from '../../../Pages/Private/Health/Labs/labFormat';

export interface Lab_Report_Initial {
  collectedAt: string | null;
  lab: string | null;
  notes: string | null;
  results: LabResult[];
}

interface Lab_Report_Modal_Props {
  initial: Lab_Report_Initial;
  source: 'PDF' | 'MANUAL';
  file: File | null;
  reportId?: string;
  onSaved: (id: string) => void;
  onClose: () => void;
}

interface ResultRow {
  key: string;
  name: string;
  section: string | null;
  group: string | null;
  value: string;
  unit: string;
  reference: string;
  flag: string | null;
}

const toRow = (result: LabResult): ResultRow => ({
  key: result.key,
  name: result.name,
  section: result.section,
  group: result.group,
  value: valueInput(result),
  unit: result.unit ?? '',
  reference: formatLabReference(result) === '—' ? '' : formatLabReference(result),
  flag: result.flag,
});

const EMPTY_ROW: ResultRow = { key: '', name: '', section: null, group: null, value: '', unit: '', reference: '', flag: null };

const Lab_Report_Modal = ({ initial, source, file, reportId, onSaved, onClose }: Lab_Report_Modal_Props) => {
  const { t } = useTranslation('health');
  const { analytes, saving, saveReport } = useLabEditor();
  const [collectedAt, setCollectedAt] = useState(initial.collectedAt ?? '');
  const [lab, setLab] = useState(initial.lab ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [rows, setRows] = useState<ResultRow[]>(initial.results.length ? initial.results.map(toRow) : [EMPTY_ROW]);
  const [error, setError] = useState('');

  const filled = rows.filter((row) => row.name.trim() && row.value.trim());
  const canSave = !saving && /^\d{4}-\d{2}-\d{2}$/.test(collectedAt) && filled.length > 0;

  const updateRow = (index: number, change: Partial<ResultRow>) => {
    setRows(rows.map((row, position) => (position === index ? { ...row, ...change } : row)));
    setError('');
  };

  const pickName = (index: number, name: string) => {
    const known = analytes.find((analyte) => analyte.name === name);
    updateRow(index, { name, key: known ? known.key : rows[index].key });
  };

  const handleSave = async () => {
    if (!canSave) return;
    const { id, error: failure } = await saveReport(
      {
        collectedAt,
        lab: lab.trim() || null,
        source,
        notes: notes.trim() || null,
        results: filled.map((row) => ({
          key: row.key || undefined,
          name: row.name.trim(),
          section: row.section,
          group: row.group,
          unit: row.unit.trim() || null,
          ...parseLabValue(row.value),
          ...parseLabReference(row.reference),
          flag: row.flag === 'ABNORMAL' ? 'ABNORMAL' : null,
        })),
      },
      { id: reportId, file },
    );
    if (failure || !id) setError(failure ?? '');
    else onSaved(id);
  };

  return (
    <div className='Lab_Report_Modal_Overlay' onClick={() => !saving && onClose()}>
      <div className='Lab_Report_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Lab_Report_Modal_Head'>
          <span className='Lab_Report_Modal_Title'>
            {reportId ? t('labs.modal.editTitle') : source === 'PDF' ? t('labs.modal.reviewTitle') : t('labs.modal.manualTitle')}
          </span>
          <span className='Lab_Report_Modal_Subtitle'>
            {source === 'PDF' && !reportId ? t('labs.modal.reviewHint', { count: initial.results.length }) : t('labs.modal.manualHint')}
          </span>
        </div>

        <div className='Lab_Report_Modal_Row'>
          <div className='Lab_Report_Modal_Field'>
            <label htmlFor='lab-date'>{t('labs.modal.date')}</label>
            <Global_Input id='lab-date' type='date' value={collectedAt} onChange={(e) => setCollectedAt(e.target.value)} />
          </div>
          <div className='Lab_Report_Modal_Field'>
            <label htmlFor='lab-name'>{t('labs.modal.lab')}</label>
            <Global_Input id='lab-name' value={lab} placeholder='Unilabs' onChange={(e) => setLab(e.target.value)} />
          </div>
        </div>

        <datalist id='lab-analytes'>
          {analytes.map((analyte) => (
            <option key={analyte.key} value={analyte.name} />
          ))}
        </datalist>

        <div className='Lab_Report_Modal_Results'>
          <div className='Lab_Report_Modal_Result Lab_Report_Modal_Result_Head'>
            <span>{t('labs.columns.parameter')}</span>
            <span>{t('labs.columns.value')}</span>
            <span>{t('labs.columns.unit')}</span>
            <span>{t('labs.columns.reference')}</span>
            <span />
          </div>
          <div className='Lab_Report_Modal_Result_Body'>
            {rows.map((row, index) => (
              <div className={`Lab_Report_Modal_Result${row.flag ? ' flagged' : ''}`} key={index}>
                <div className='Lab_Report_Modal_Name'>
                  <Global_Input value={row.name} list='lab-analytes' onChange={(e) => pickName(index, e.target.value)} />
                  {(row.section || row.group) && <small>{[row.section, row.group].filter(Boolean).join(' · ')}</small>}
                </div>
                <Global_Input value={row.value} onChange={(e) => updateRow(index, { value: e.target.value, flag: null })} />
                <Global_Input value={row.unit} onChange={(e) => updateRow(index, { unit: e.target.value })} />
                <Global_Input value={row.reference} placeholder='13.2-16.6' onChange={(e) => updateRow(index, { reference: e.target.value })} />
                <button
                  type='button'
                  className='Lab_Report_Modal_Remove'
                  aria-label={t('labs.modal.remove')}
                  title={t('labs.modal.remove')}
                  onClick={() => setRows(rows.filter((_, position) => position !== index))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type='button' className='Lab_Report_Modal_Add' onClick={() => setRows([...rows, EMPTY_ROW])}>
            {t('labs.modal.addResult')}
          </button>
        </div>

        <div className='Lab_Report_Modal_Field'>
          <label htmlFor='lab-notes'>{t('labs.modal.notes')}</label>
          <textarea id='lab-notes' rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <p className='Lab_Report_Modal_Error'>{error}</p>}

        <div className='Lab_Report_Modal_Actions'>
          <button type='button' className='Cancel_Button' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </button>
          <button type='button' className='Save_Button' onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? t('labs.modal.saving') : t('labs.modal.save', { count: filled.length })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Lab_Report_Modal;
