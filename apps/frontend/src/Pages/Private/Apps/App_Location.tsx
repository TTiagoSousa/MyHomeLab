import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useConnectedAccount } from '../../../Hooks/ConnectedAccount/useConnectedAccount';
import App_Location_Fields from '../../../Components/App_Location_Fields/App_Location_Fields';

interface App_Location_Props {
  account: ConnectedAccount;
  onSaved: () => void;
}

const App_Location = ({ account, onSaved }: App_Location_Props) => {
  const { t } = useTranslation('addons');
  const { updateLocation, loading: saving } = useConnectedAccount();
  const [serverId, setServerId] = useState(account.serverConnectionId ?? '');
  const [vmid, setVmid] = useState(account.guestVmid != null ? String(account.guestVmid) : '');

  const changed = serverId !== (account.serverConnectionId ?? '') || vmid !== (account.guestVmid != null ? String(account.guestVmid) : '');

  const changeLocation = (nextServerId: string, nextVmid: string) => {
    setServerId(nextServerId);
    setVmid(nextVmid);
  };

  const save = async () => {
    const success = await updateLocation(account.id, { serverConnectionId: serverId || null, guestVmid: serverId && vmid ? Number(vmid) : null });
    if (success) onSaved();
  };

  return (
    <div className='Apps_location' id='app-location'>
      <span className='Apps_commands_title'>{t('apps.account.location.title')}</span>
      <App_Location_Fields
        serverId={serverId}
        vmid={vmid}
        onChange={changeLocation}
        className='Apps_inline_fields'
        fieldClassName='Apps_inline_field'
        errorClassName='Apps_section_note error'
      />
      <p className='Apps_section_note'>{t('apps.account.location.hint')}</p>
      {changed && (
        <div className='Apps_location_actions'>
          <button
            type='button'
            onClick={() => {
              setServerId(account.serverConnectionId ?? '');
              setVmid(account.guestVmid != null ? String(account.guestVmid) : '');
            }}
            disabled={saving}
          >
            {t('apps.cancel')}
          </button>
          <button type='button' className='active' onClick={() => void save()} disabled={saving}>
            {saving ? t('apps.account.location.saving') : t('apps.account.location.save')}
          </button>
        </div>
      )}
    </div>
  );
};

export default App_Location;
