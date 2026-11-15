import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RunFrequency } from '@myhomelab/shared';
import '../Server_Modal/Server_Modal.scss';
import './Backup_Job_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../Inputs/Global_Dropdown/Global_Dropdown';
import { FREQUENCY_OPTIONS } from '../../../Constants/runFrequency';
import type {
  BackupDestination,
  BackupJob,
  BackupJobPayload,
  BackupRetention,
} from '../../../Hooks/Backups/backupTypes';

interface Backup_Job_Modal_Props {
  serviceName: string;
  defaultFolder: string;
  fileExample: string;
  existing: BackupJob | null;
  destinations: BackupDestination[];
  saving: boolean;
  onSave: (payload: BackupJobPayload) => Promise<string | null>;
  onClose: () => void;
}

const RETENTIONS: BackupRetention[] = ['REPLACE', 'KEEP_LAST', 'KEEP_ALL'];

const Backup_Job_Modal = ({
  serviceName,
  defaultFolder,
  fileExample,
  existing,
  destinations,
  saving,
  onSave,
  onClose,
}: Backup_Job_Modal_Props) => {
  const { t } = useTranslation('servers');
  const [destinationId, setDestinationId] = useState(existing?.destinationId ?? destinations[0]?.id ?? '');
  const [folder, setFolder] = useState(existing?.folder ?? defaultFolder);
  const [runFrequency, setRunFrequency] = useState<RunFrequency>(existing?.runFrequency ?? 'DAILY');
  const [retention, setRetention] = useState<BackupRetention>(existing?.retention ?? 'KEEP_LAST');
  const [keepCount, setKeepCount] = useState(String(existing?.keepCount ?? 3));
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [error, setError] = useState('');

  const destination = destinations.find((item) => item.id === destinationId);
  const keepNumber = Number(keepCount);
  const keepValid = Number.isInteger(keepNumber) && keepNumber >= 1 && keepNumber <= 365;
  const canSave = !saving && Boolean(destination) && folder.trim().length > 0 && (retention !== 'KEEP_LAST' || keepValid);
  const fullPath = destination ? `/${destination.folder}/${folder.trim().replace(/^\/+|\/+$/g, '')}` : '';

  const handleSave = async () => {
    if (!canSave) return;
    setError('');
    const failure = await onSave({
      destinationId,
      folder: folder.trim(),
      runFrequency,
      retention,
      keepCount: keepValid ? keepNumber : 3,
      isActive,
    });
    if (failure) setError(failure);
    else onClose();
  };

  return (
    <div className='Server_Modal_Overlay' onClick={() => !saving && onClose()}>
      <div className='Server_Modal Backup_Job_Modal' onClick={(e) => e.stopPropagation()}>
        <div className='Server_Modal_Head'>
          <span className='Server_Modal_Mark'>B</span>
          <div>
            <span className='Server_Modal_Title'>
              {existing ? t('backups.modal.editTitle') : t('backups.modal.title')}
            </span>
            <span className='Server_Modal_Kind'>{serviceName}</span>
          </div>
        </div>

        <div className='Server_Modal_Field'>
          <label htmlFor='backup-job-destination'>{t('backups.modal.destination')}</label>
          <Global_Dropdown
            id='backup-job-destination'
            value={destinationId}
            options={destinations.map((item) => ({ value: item.id, label: [item.name, item.url].filter(Boolean).join(' · ') }))}
            onChange={setDestinationId}
          />
          <span className='Server_Modal_Hint'>{t('backups.modal.destinationHint')}</span>
        </div>

        <div className='Server_Modal_Field'>
          <label htmlFor='backup-job-folder'>{t('backups.modal.folder')}</label>
          <Global_Input
            id='backup-job-folder'
            autoComplete='off'
            value={folder}
            placeholder={defaultFolder}
            onChange={(e) => {
              setFolder(e.target.value);
              setError('');
            }}
          />
          {fullPath && <span className='Server_Modal_Hint'>{t('backups.modal.folderHint', { path: fullPath, file: fileExample })}</span>}
        </div>

        <div className='Server_Modal_Field'>
          <label htmlFor='backup-job-frequency'>{t('backups.modal.frequency')}</label>
          <Global_Dropdown
            id='backup-job-frequency'
            value={runFrequency}
            options={FREQUENCY_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
            onChange={(value) => setRunFrequency(value as RunFrequency)}
          />
        </div>

        <div className='Server_Modal_Field'>
          <label>{t('backups.modal.retention')}</label>
          <div className='Backup_Job_Modal_Retentions'>
            {RETENTIONS.map((option) => (
              <button
                key={option}
                type='button'
                className={retention === option ? 'active' : ''}
                onClick={() => setRetention(option)}
              >
                <span>{t(`backups.retention.${option}.name`)}</span>
                <small>{t(`backups.retention.${option}.hint`)}</small>
              </button>
            ))}
          </div>
        </div>

        {retention === 'KEEP_LAST' && (
          <div className={`Server_Modal_Field${keepCount && !keepValid ? ' invalid' : ''}`}>
            <label htmlFor='backup-job-keep'>{t('backups.modal.keepCount')}</label>
            <Global_Input
              id='backup-job-keep'
              type='number'
              value={keepCount}
              onChange={(e) => setKeepCount(e.target.value)}
            />
          </div>
        )}

        <span className='Server_Modal_Hint'>{t('backups.modal.onlyOurs')}</span>

        <label className='Server_Modal_Check'>
          <span>
            {t('backups.modal.active')}
            <small>{t('backups.modal.activeHint')}</small>
          </span>
          <input type='checkbox' checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        </label>

        {error && <p className='Server_Modal_Error'>{error}</p>}

        <div className='Server_Modal_Actions'>
          <button type='button' className='Cancel_Button' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </button>
          <button type='button' className='Save_Button' onClick={() => void handleSave()} disabled={!canSave}>
            {saving ? t('backups.modal.saving') : t('backups.modal.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Backup_Job_Modal;
