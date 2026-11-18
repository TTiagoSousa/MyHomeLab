import { useTranslation } from 'react-i18next';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import Global_Dropdown from '../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import { useServerGuests } from '../../../Hooks/Servers/useServerGuests';
import { useAgentNames } from '../../../Hooks/Agent/useAgentNames';
import type { Cron_Options_Panel_Props } from './App_Cron_Job';

const numberOrEmpty = (value: unknown) => (typeof value === 'number' && value > 0 ? String(value) : '');

const Proxmox_Disk_Alert_Options = ({ scopeId, value, onChange, detail, disabled }: Cron_Options_Panel_Props) => {
  const { t } = useTranslation('addons');
  const { guests } = useServerGuests(scopeId);
  const { agents } = useAgentNames();
  const chosen = Array.isArray(value.guests) ? (value.guests as number[]) : null;
  const noAgent = Array.isArray(detail?.noAgent) ? (detail.noAgent as { vmid: number; name: string }[]) : [];

  const set = (patch: Record<string, unknown>) => onChange({ ...value, ...patch });
  const setNumber = (field: string, raw: string) => set({ [field]: raw === '' ? null : Number(raw) });
  const toggleGuest = (vmid: number) => {
    const current = chosen ?? [];
    set({ guests: current.includes(vmid) ? current.filter((id) => id !== vmid) : [...current, vmid] });
  };

  return (
    <div className='Disk_Alert_Options'>
      <div className='Disk_Alert_Options_row'>
        <label htmlFor='disk-alert-threshold'>{t('cronJobs.diskAlert.threshold')}</label>
        <Global_Input
          id='disk-alert-threshold'
          type='number'
          min='10'
          max='99'
          value={numberOrEmpty(value.thresholdPercent)}
          placeholder='%'
          onChange={(e) => setNumber('thresholdPercent', e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className='Disk_Alert_Options_row'>
        <span className='Disk_Alert_Options_label'>{t('cronJobs.diskAlert.guests')}</span>
        <div className='Disk_Alert_Options_choice'>
          <label>
            <input type='radio' checked={!chosen} onChange={() => set({ guests: 'all' })} disabled={disabled} />
            {t('cronJobs.diskAlert.allGuests')}
          </label>
          <label>
            <input type='radio' checked={Boolean(chosen)} onChange={() => set({ guests: [] })} disabled={disabled} />
            {t('cronJobs.diskAlert.someGuests')}
          </label>
        </div>
      </div>
      {chosen && (
        <div className='Disk_Alert_Options_guests'>
          {guests.map((guest) => (
            <label key={guest.vmid} className={chosen.includes(guest.vmid) ? 'on' : ''}>
              <input type='checkbox' checked={chosen.includes(guest.vmid)} onChange={() => toggleGuest(guest.vmid)} disabled={disabled} />
              {`${guest.type === 'lxc' ? 'CT' : 'VM'} ${guest.vmid} · ${guest.name}`}
            </label>
          ))}
        </div>
      )}

      <label className='Disk_Alert_Options_check'>
        <input type='checkbox' checked={value.notify === true} onChange={(e) => set({ notify: e.target.checked })} disabled={disabled} />
        {t('cronJobs.diskAlert.notify')}
      </label>
      <label className='Disk_Alert_Options_check'>
        <input type='checkbox' checked={value.agent === true} onChange={(e) => set({ agent: e.target.checked })} disabled={disabled} />
        <span>
          {t('cronJobs.diskAlert.agent')}
          <small>{t('cronJobs.diskAlert.agentHint')}</small>
        </span>
      </label>

      {value.agent === true && (
        <div className='Disk_Alert_Options_agent'>
          <div className='Disk_Alert_Options_row'>
            <label htmlFor='disk-alert-agent'>{t('cronJobs.diskAlert.agentKey')}</label>
            <Global_Dropdown
              id='disk-alert-agent'
              value={typeof value.agentKey === 'string' ? value.agentKey : ''}
              onChange={(key) => set({ agentKey: key || null })}
              options={[
                { value: '', label: t('cronJobs.diskAlert.agentAuto') },
                ...agents.filter((agent) => agent.isActive).map((agent) => ({ value: agent.key, label: agent.name })),
              ]}
              disabled={disabled}
            />
          </div>
          {(['maxDiskGb', 'stepGb', 'minStorageFreeGb'] as const).map((field) => (
            <div key={field} className='Disk_Alert_Options_row'>
              <label htmlFor={`disk-alert-${field}`}>{t(`cronJobs.diskAlert.${field}`)}</label>
              <Global_Input
                id={`disk-alert-${field}`}
                type='number'
                min='1'
                value={numberOrEmpty(value[field])}
                placeholder='GB'
                onChange={(e) => setNumber(field, e.target.value)}
                disabled={disabled}
              />
            </div>
          ))}
          <p className='Disk_Alert_Options_note'>{t('cronJobs.diskAlert.limitsNote')}</p>
        </div>
      )}

      {noAgent.length > 0 && (
        <p className='Disk_Alert_Options_note warning'>
          {t('cronJobs.diskAlert.noAgent', { guests: noAgent.map((guest) => `VM ${guest.vmid} (${guest.name})`).join(', ') })}
        </p>
      )}
    </div>
  );
};

export default Proxmox_Disk_Alert_Options;
