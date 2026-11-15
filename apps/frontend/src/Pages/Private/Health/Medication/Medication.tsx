import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../Shared/Health_Dashboard.scss';
import './Medication.scss';
import { useMedications } from '../../../../Hooks/Health/useMedications';
import { useHealthConditions } from '../../../../Hooks/Health/useHealthConditions';
import type { Medication as MedicationEntry, MedicationKind } from '../../../../Hooks/Health/healthTypes';
import Medication_Modal from '../../../../Components/Modals/Medication_Modal/Medication_Modal';
import Medication_Active_Card from './Medication_Active_Card';
import Medication_Past_Row from './Medication_Past_Row';
import { MEDICATION_KINDS, formatDose, formatFrequency, isStillTaking, todayInput, toPayload } from './medicationFormat';

type Editing = { medication: MedicationEntry | null } | null;

const Medication = () => {
  const { t } = useTranslation('health');
  const navigate = useNavigate();
  const { medications, loading, saving, error, saveMedication, stopMedication, removeMedication } = useMedications();
  const [editing, setEditing] = useState<Editing>(null);
  const [kindFilter, setKindFilter] = useState<MedicationKind | null>(null);
  const { conditions } = useHealthConditions();
  const visible = medications.filter((medication) => !kindFilter || medication.kind === kindFilter);
  const active = visible.filter((medication) => isStillTaking(medication));
  const past = visible
    .filter((medication) => !isStillTaking(medication))
    .sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''));
  const schedule = active
    .flatMap((medication) => medication.times.map((time) => ({ time, medication })))
    .sort((a, b) => a.time.localeCompare(b.time));
  const withoutTime = active.filter((medication) => !medication.times.length);

  return (
    <div className='Health_Dashboard'>
      <header>
        <div className='Right_Side'>
          <button type='button' className='Health_back' onClick={() => navigate('/MyHomeLab/Health')}>
            ← {t('page.title')}
          </button>
          <span>{t('medication.title')}</span>
        </div>
        <div className='Left_Side'>
          <button type='button' className='Health_see_all' onClick={() => setEditing({ medication: null })}>
            {t('medication.add')}
          </button>
        </div>
      </header>

      {error && <div className='Health_empty'>{error}</div>}

      {medications.length > 0 && (
        <div className='Medication_Filter' role='radiogroup' aria-label={t('medication.filter')}>
          {[null, ...MEDICATION_KINDS].map((kind) => (
            <button
              key={kind ?? 'all'}
              type='button'
              role='radio'
              aria-checked={kindFilter === kind}
              className={kindFilter === kind ? 'active' : ''}
              onClick={() => setKindFilter(kind)}
            >
              {kind ? t(`medication.kindsPlural.${kind}`) : t('medication.all')}
              <small>{kind ? medications.filter((medication) => medication.kind === kind).length : medications.length}</small>
            </button>
          ))}
        </div>
      )}

      {!loading && !error && medications.length > 0 && !visible.length && (
        <div className='Health_empty'>
          <span>{t('medication.emptyKind')}</span>
        </div>
      )}

      {!loading && !error && !medications.length && (
        <div className='Health_empty'>
          <span className='Health_empty_title'>{t('medication.emptyTitle')}</span>
          <span>{t('medication.emptyText')}</span>
        </div>
      )}

      {active.length > 0 && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('medicationStatus.activeTitle', { count: active.length })}</span>
              <p className='Health_card_description'>{t('medicationStatus.activeDescription')}</p>
            </div>
          </div>
          <div className='Medication_Active_List'>
            {active.map((medication) => (
              <Medication_Active_Card
                key={medication.id}
                medication={medication}
                saving={saving}
                onEdit={() => setEditing({ medication })}
                onStop={() => void stopMedication(medication.id, toPayload(medication, { endDate: todayInput() }))}
                onRemove={() => void removeMedication(medication.id)}
              />
            ))}
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('medication.todayTitle')}</span>
              <p className='Health_card_description'>{t('medication.todayDescription')}</p>
            </div>
          </div>
          <div className='Medication_Schedule'>
            {schedule.map(({ time, medication }) => (
              <div key={`${time}-${medication.id}`} className='Medication_Dose'>
                <em>{time}</em>
                <span>{medication.name}</span>
                <small>{formatDose(t, medication)}</small>
              </div>
            ))}
            {withoutTime.map((medication) => (
              <div key={medication.id} className='Medication_Dose'>
                <em>—</em>
                <span>{medication.name}</span>
                <small>
                  {formatDose(t, medication)} · {formatFrequency(t, medication)}
                </small>
              </div>
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className='Health_card'>
          <div className='Health_card_head'>
            <div>
              <span className='Health_card_title'>{t('medicationStatus.pastTitle', { count: past.length })}</span>
              <p className='Health_card_description'>{t('medicationStatus.pastDescription')}</p>
            </div>
          </div>
          <div className='Health_Table medication past'>
            <div className='Health_Table_Body'>
              {past.map((medication) => (
                <Medication_Past_Row
                  key={medication.id}
                  medication={medication}
                  onEdit={() => setEditing({ medication })}
                  onRemove={() => void removeMedication(medication.id)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {editing && (
        <Medication_Modal
          existing={editing.medication}
          conditions={conditions}
          saving={saving}
          onSave={(payload) => saveMedication(payload, editing.medication?.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export default Medication;
