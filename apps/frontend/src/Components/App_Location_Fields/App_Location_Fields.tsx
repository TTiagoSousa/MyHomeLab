import { useTranslation } from 'react-i18next';
import { useServers } from '../../Hooks/Servers/useServers';
import { useServerGuests } from '../../Hooks/Servers/useServerGuests';
import Global_Dropdown from '../Inputs/Global_Dropdown/Global_Dropdown';

interface App_Location_Fields_Props {
  serverId: string;
  vmid: string;
  onChange: (serverId: string, vmid: string) => void;
  className: string;
  fieldClassName: string;
  errorClassName: string;
}

const App_Location_Fields = ({ serverId, vmid, onChange, className, fieldClassName, errorClassName }: App_Location_Fields_Props) => {
  const { t } = useTranslation('addons');
  const { servers } = useServers();
  const { guests, loading: loadingGuests, error: guestsError } = useServerGuests(serverId || null);

  const serverOptions = [{ value: '', label: t('apps.account.location.noServer') }, ...servers.map((server) => ({ value: server.id, label: server.name }))];
  const guestOptions = [
    { value: '', label: loadingGuests ? t('apps.account.location.loadingGuests') : t('apps.account.location.noGuest') },
    ...guests.map((guest) => ({
      value: String(guest.vmid),
      label: t(`apps.account.location.guest.${guest.type}`, { vmid: guest.vmid, name: guest.name }),
    })),
    ...(vmid && !guests.some((guest) => String(guest.vmid) === vmid) ? [{ value: vmid, label: t('apps.account.location.guest.unknown', { vmid }) }] : []),
  ];

  return (
    <>
      <div className={className}>
        <div className={fieldClassName}>
          <label>{t('apps.account.location.server')}</label>
          <Global_Dropdown value={serverId} options={serverOptions} onChange={(value) => onChange(value, '')} searchable={false} />
        </div>
        <div className={fieldClassName}>
          <label>{t('apps.account.location.guestLabel')}</label>
          <Global_Dropdown
            value={vmid}
            options={guestOptions}
            onChange={(value) => onChange(serverId, value)}
            disabled={!serverId}
            maxVisibleOptions={8}
            searchable={guests.length > 8}
          />
        </div>
      </div>
      {serverId && guestsError && <p className={errorClassName}>{guestsError}</p>}
    </>
  );
};

export default App_Location_Fields;
