import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackupDestinations } from '../../../Hooks/Backups/useBackupDestinations';
import type { BackupDestination, BackupDestinationCheck } from '../../../Hooks/Backups/backupTypes';
import { BACKUP_DESTINATION_KINDS } from '../../../Constants/backupDestinationKinds';
import Backup_Destination_Modal from '../../../Components/Modals/Backup_Destination_Modal/Backup_Destination_Modal';
import Add_Menu from '../../../Components/Add_Menu/Add_Menu';
import { formatBytes } from '../Servers/format';
import * as Icon from '../../../Imports/icons';

interface Destination_Row_Props {
  destination: BackupDestination;
  confirmingRemove: boolean;
  checkDestination: (id: string) => Promise<BackupDestinationCheck>;
  onEdit: () => void;
  onRemove: () => void;
}

const Destination_Row = ({ destination, confirmingRemove, checkDestination, onEdit, onRemove }: Destination_Row_Props) => {
  const { t } = useTranslation('addons');
  const [check, setCheck] = useState<BackupDestinationCheck | null>(null);

  useEffect(() => {
    setCheck(null);
    checkDestination(destination.id).then(setCheck);
  }, [destination.id, destination.updatedAt]);

  const status = !check
    ? t('backups.checking')
    : !check.ok
      ? check.error
      : check.freeBytes != null
        ? t('backups.connectedFree', { user: check.user, free: formatBytes(check.freeBytes) })
        : t('backups.connected', { user: check.user });

  return (
    <div className='Apps_pair'>
      <span className={`Apps_pair_dot${check?.ok ? ' active' : ''}`} />

      <div className='Apps_pair_info'>
        <span className='Apps_pair_title'>
          {destination.name} · {t('backups.kinds.NEXTCLOUD')}
        </span>
        <span className='Apps_pair_meta'>
          {destination.account
            ? t('backups.linkedAccount', { name: destination.account.name ?? destination.username })
            : [destination.url, destination.username].filter(Boolean).join(' · ')}{' '}
          · /{destination.folder}
          {destination.account?.disconnected && ` · ${t('backups.accountDisconnected')}`}
        </span>
        <span className={`Apps_pair_meta${check && !check.ok ? ' error' : ''}`}>
          {status} · {t('backups.usedBy', { count: destination.jobCount })}
        </span>
      </div>

      <button type='button' onClick={onEdit}>
        {t('backups.edit')}
      </button>
      {confirmingRemove ? (
        <button type='button' className='danger' onClick={onRemove}>
          {t('backups.confirmRemove')}
        </button>
      ) : (
        <button type='button' className='Apps_pair_delete' onClick={onRemove}>
          <Icon.Close />
        </button>
      )}
    </div>
  );
};

const Apps_Backups = () => {
  const { t } = useTranslation('addons');
  const { destinations, loading, saving, saveDestination, removeDestination, checkDestination } = useBackupDestinations();
  const [editing, setEditing] = useState<{ destination: BackupDestination | null } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const menuOptions = BACKUP_DESTINATION_KINDS.map((kind) => ({
    id: kind.kind,
    name: t(kind.labelKey),
    available: kind.available,
  }));

  const handleRemove = async (id: string) => {
    if (confirmRemove !== id) {
      setConfirmRemove(id);
      return;
    }
    setConfirmRemove(null);
    await removeDestination(id);
  };

  return (
    <div className='Apps_section'>
      <header>
        <div className='Apps_section_title'>
          <Icon.Server />
          <div>
            <span>{t('backups.title')}</span>
            <p>{t('backups.description')}</p>
          </div>
        </div>

        <Add_Menu
          label={t('backups.add')}
          title={t('backups.menuLabel')}
          soonLabel={t('backups.soon')}
          options={menuOptions}
          onSelect={() => setEditing({ destination: null })}
        />
      </header>

      {!loading && destinations.length === 0 ? (
        <button className='Apps_section_connect' onClick={() => setEditing({ destination: null })}>
          <Icon.Plus />
          <span>{t('backups.empty')}</span>
        </button>
      ) : (
        <div className='Apps_pairs'>
          {destinations.map((destination) => (
            <Destination_Row
              key={destination.id}
              destination={destination}
              confirmingRemove={confirmRemove === destination.id}
              checkDestination={checkDestination}
              onEdit={() => setEditing({ destination })}
              onRemove={() => handleRemove(destination.id)}
            />
          ))}
        </div>
      )}

      {editing && (
        <Backup_Destination_Modal
          existing={editing.destination}
          saving={saving}
          onSave={(payload) => saveDestination(payload, editing.destination?.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export default Apps_Backups;
