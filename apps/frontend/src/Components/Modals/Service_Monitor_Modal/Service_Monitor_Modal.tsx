import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './Service_Monitor_Modal.scss';
import Global_Input from '../../Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../Inputs/Global_Dropdown/Global_Dropdown';
import http from '../../../Service/httpService';
import { End_Points } from '../../../Service/endPoints';
import { useServers } from '../../../Hooks/Servers/useServers';
import type {
  MonitorKind,
  ServiceMonitor,
  ServiceMonitorPayload,
} from '../../../Hooks/ServiceMonitors/useServiceMonitors';

interface Guest {
  vmid: number;
  name: string;
  type: string;
}

interface Service_Monitor_Modal_Props {
  existing: ServiceMonitor | null;
  saving: boolean;
  onSave: (payload: ServiceMonitorPayload) => Promise<string | null>;
  onClose: () => void;
}

const KINDS: MonitorKind[] = ['HTTP', 'TCP'];
const INTERVALS = [1, 5, 10, 15, 30, 60, 180, 360, 720, 1440];
const NONE = '';

const Service_Monitor_Modal = ({ existing, saving, onSave, onClose }: Service_Monitor_Modal_Props) => {
  const { t } = useTranslation('servers');
  const { t: tServices } = useTranslation('services');
  const { servers } = useServers();

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<MonitorKind>(existing?.kind ?? 'HTTP');
  const [target, setTarget] = useState(existing?.target ?? '');
  const [intervalMinutes, setIntervalMinutes] = useState(String(existing?.intervalMinutes ?? 5));
  const [serverId, setServerId] = useState(existing?.server?.id ?? NONE);
  const [guestVmid, setGuestVmid] = useState(existing?.guestVmid != null ? String(existing.guestVmid) : NONE);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [error, setError] = useState('');
  const fetchGuests = async (id: string) => {
    setLoadingGuests(true);
    try {
      const response = await http.get(End_Points.Server_Guests_Endpoint(id), { withCredentials: true });
      setGuests(response.data);
    } catch {
      setGuests([]);
    } finally {
      setLoadingGuests(false);
    }
  };

  useEffect(() => {
    if (serverId) fetchGuests(serverId);
  }, [serverId]);

  const handleServerChange = (value: string) => {
    setServerId(value);
    setGuestVmid(NONE);
    setGuests([]);
  };

  const canSave = !saving && name.trim().length > 0 && target.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;

    const guest = guests.find((entry) => String(entry.vmid) === guestVmid);
    setError('');
    const failure = await onSave({
      name: name.trim(),
      kind,
      target: target.trim(),
      intervalMinutes: Number(intervalMinutes),
      serverConnectionId: serverId || null,
      guestVmid: serverId && guestVmid ? Number(guestVmid) : null,
      guestName: serverId && guestVmid ? (guest?.name ?? existing?.guestName ?? null) : null,
    });
    if (failure) setError(failure);
    else onClose();
  };

  const intervalOptions = INTERVALS.map((minutes) => ({
    value: String(minutes),
    label: t('monitors.every', { count: minutes }),
  }));

  const serverOptions = [
    { value: NONE, label: t('monitors.modal.noServer') },
    ...servers.map((server) => ({ value: server.id, label: server.name })),
  ];

  const guestOptions = [
    { value: NONE, label: loadingGuests ? t('monitors.modal.loadingMachines') : t('monitors.modal.noMachine') },
    ...guests.map((guest) => ({
      value: String(guest.vmid),
      label: `${guest.vmid} · ${guest.name} (${guest.type === 'qemu' ? 'VM' : 'LXC'})`,
    })),
  ];

  return (
    <div className='Service_Monitor_Modal_Overlay' onClick={() => !saving && onClose()}>
      <div className='Service_Monitor_Modal' onClick={(e) => e.stopPropagation()}>
        <span className='Service_Monitor_Modal_Title'>
          {existing ? t('monitors.modal.editTitle', { name: existing.name }) : t('monitors.modal.title')}
        </span>

        <div className='Service_Monitor_Modal_Field'>
          <label htmlFor='monitor-name'>{t('monitors.modal.name')}</label>
          <Global_Input
            id='monitor-name'
            value={name}
            placeholder={t('monitors.modal.namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {existing?.app && (
          <span className='Service_Monitor_Modal_Hint'>{tServices('appMonitor.managedHint', { name: existing.app.name })}</span>
        )}

        {!existing?.app && (
          <div className='Service_Monitor_Modal_Field'>
            <label>{t('monitors.modal.kind')}</label>
            <div className='Service_Monitor_Modal_Kinds'>
              {KINDS.map((value) => (
                <button
                  key={value}
                  type='button'
                  className={kind === value ? 'active' : ''}
                  onClick={() => setKind(value)}
                >
                  {t(`monitors.kind.${value}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {!existing?.app && (
          <div className='Service_Monitor_Modal_Field'>
            <label htmlFor='monitor-target'>{t(`monitors.modal.target${kind}`)}</label>
            <Global_Input
              id='monitor-target'
              value={target}
              placeholder={kind === 'TCP' ? '192.168.1.10:53' : 'https://servico.example.com'}
              onChange={(e) => setTarget(e.target.value)}
            />
            <span className='Service_Monitor_Modal_Hint'>{t(`monitors.modal.hint${kind}`)}</span>
          </div>
        )}

        <div className='Service_Monitor_Modal_Field'>
          <label>{t('monitors.modal.interval')}</label>
          <Global_Dropdown value={intervalMinutes} options={intervalOptions} onChange={setIntervalMinutes} searchable={false} />
        </div>

        {!existing?.app && (
          <div className='Service_Monitor_Modal_Field'>
            <label>{t('monitors.modal.server')}</label>
            <Global_Dropdown value={serverId} options={serverOptions} onChange={handleServerChange} searchable={false} />
          </div>
        )}

        {serverId && !existing?.app && (
          <div className='Service_Monitor_Modal_Field'>
            <label>{t('monitors.modal.machine')}</label>
            <Global_Dropdown value={guestVmid} options={guestOptions} onChange={setGuestVmid} />
          </div>
        )}

        {error && <p className='Service_Monitor_Modal_Error'>{error}</p>}

        <div className='Service_Monitor_Modal_Actions'>
          <button type='button' className='Cancel_Button' onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </button>
          <button type='button' className='Save_Button' onClick={handleSave} disabled={!canSave}>
            {saving ? t('monitors.modal.testing') : t('monitors.modal.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Service_Monitor_Modal;
