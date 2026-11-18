import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useServers } from '../../../Hooks/Servers/useServers';
import App_Cron_Jobs from './App_Cron_Jobs';
import Proxmox_Disk_Alert_Options from './Proxmox_Disk_Alert_Options';

const OPTION_PANELS = { 'proxmox.disk_alert': Proxmox_Disk_Alert_Options };

const Proxmox_Cron_Jobs = () => {
  const { t } = useTranslation('addons');
  const { serverId } = useParams();
  const { servers } = useServers();
  const server = servers.find((item) => item.id === serverId);

  return (
    <App_Cron_Jobs
      scope={{ kind: 'server', id: serverId }}
      optionPanels={OPTION_PANELS}
      backTo={`/MyHomeLab/Apps/Proxmox/${serverId}`}
      backLabel={server?.name ?? 'Proxmox'}
      note={t('cronJobs.proxmoxNote')}
    />
  );
};

export default Proxmox_Cron_Jobs;
