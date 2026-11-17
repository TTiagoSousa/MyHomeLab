import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../Apps/Apps.scss';
import { useInstanceBackup } from '../../../Hooks/Backups/useInstanceBackup';
import Instance_Backup_Password_Modal from '../../../Components/Modals/Instance_Backup_Password_Modal/Instance_Backup_Password_Modal';
import Instance_Restore_Modal from '../../../Components/Modals/Instance_Restore_Modal/Instance_Restore_Modal';
import App_Backups from '../Apps/App_Backups';
import { dateLocale } from '../../../i18n';
import * as Icon from '../../../Imports/icons';

const Instance_Backup = () => {
  const { t } = useTranslation('admin');
  const { settings, saving, downloading, savePassword, download } = useInstanceBackup();
  const [editingPassword, setEditingPassword] = useState(false);
  const [restoring, setRestoring] = useState(false);

  if (!settings) return null;

  return (
    <section className='Admin_Backup'>
      <header>
        <div>
          <span className='Admin_Backup_Title'>
            <Icon.Server />
            {t('backup.title')}
          </span>
          <p>{t('backup.description')}</p>
        </div>
        <div className='Admin_Backup_Actions'>
          <button type='button' onClick={() => void download()} disabled={!settings.passwordSet || downloading}>
            {downloading ? t('backup.creating') : t('backup.download')}
          </button>
          <button type='button' className='danger' onClick={() => setRestoring(true)} disabled={!settings.restoreEnabled}>
            {t('backup.restore.open')}
          </button>
        </div>
      </header>

      <div className={`Admin_Backup_Password${settings.passwordSet ? '' : ' missing'}`}>
        <span>
          {settings.passwordSet && settings.passwordUpdatedAt
            ? t('backup.password.setOn', { date: new Date(settings.passwordUpdatedAt).toLocaleDateString(dateLocale()) })
            : t('backup.password.missing')}
        </span>
        <button type='button' onClick={() => setEditingPassword(true)}>
          {settings.passwordSet ? t('backup.password.change') : t('backup.password.set')}
        </button>
      </div>

      {!settings.restoreEnabled && <p className='Admin_Backup_Note'>{t('backup.restore.disabled')}</p>}

      {settings.passwordSet && (
        <div className='Apps Admin_Backup_Jobs'>
          <App_Backups
            accountId={null}
            serviceName='MyHomeLab'
            defaultFolder='MyHomeLab'
            fileExample='myhomelab-2026-11-17_030000.zip'
            textKey='admin:backup.jobs'
          />
        </div>
      )}

      {editingPassword && (
        <Instance_Backup_Password_Modal
          replacing={settings.passwordSet}
          saving={saving}
          onSave={savePassword}
          onClose={() => setEditingPassword(false)}
        />
      )}

      {restoring && <Instance_Restore_Modal onClose={() => setRestoring(false)} />}
    </section>
  );
};

export default Instance_Backup;
