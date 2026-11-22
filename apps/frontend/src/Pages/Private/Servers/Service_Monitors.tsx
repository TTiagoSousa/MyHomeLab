import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServiceMonitors, type ServiceMonitor } from '../../../Hooks/ServiceMonitors/useServiceMonitors';
import Service_Monitor_Modal from '../../../Components/Modals/Service_Monitor_Modal/Service_Monitor_Modal';
import * as Icon from '../../../Imports/icons';
import Service_Monitor_Row from './Service_Monitor_Row';

const EXPANDED_KEY = 'servers.monitorsExpanded';

const Service_Monitors = () => {
  const { t } = useTranslation('servers');
  const { monitors, loading, error, saving, checkingId, saveMonitor, removeMonitor, checkMonitor } = useServiceMonitors();
  const [expanded, setExpanded] = useState(localStorage.getItem(EXPANDED_KEY) === 'true');
  const [editing, setEditing] = useState<ServiceMonitor | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const toggleExpanded = () => {
    setExpanded(!expanded);
    localStorage.setItem(EXPANDED_KEY, String(!expanded));
  };

  const downCount = monitors.filter((monitor) => monitor.status === 'DOWN').length;

  const handleRemove = async (id: string) => {
    if (confirmRemove !== id) {
      setConfirmRemove(id);
      return;
    }
    setConfirmRemove(null);
    await removeMonitor(id);
  };

  const closeModal = () => {
    setCreating(false);
    setEditing(null);
  };

  return (
    <section className={`Servers_card Servers_collapsible${expanded ? ' expanded' : ''}`}>
      <div className='Servers_monitors_head'>
        <button type='button' className='Servers_collapse_toggle' onClick={toggleExpanded}>
          <span className='Servers_collapse_chevron'>
            <Icon.Chevron />
          </span>
          <span className='Servers_card_label'>{t('monitors.title', { count: monitors.length })}</span>
          {downCount > 0 && <span className='Servers_monitors_alert'>{t('monitors.downCount', { count: downCount })}</span>}
        </button>

        <button type='button' className='Servers_monitors_add' onClick={() => setCreating(true)}>
          <Icon.Plus />
          <span>{t('monitors.add')}</span>
        </button>
      </div>

      <div className='Servers_collapse_body'>
        <div className='Servers_collapse_inner'>
          {error && <p className='Servers_card_empty error'>{error}</p>}
          {!error && monitors.length === 0 && (
            <p className='Servers_card_empty'>{loading ? t('common:state.loading') : t('monitors.empty')}</p>
          )}

          {monitors.map((monitor) => (
            <Service_Monitor_Row
              key={monitor.id}
              monitor={monitor}
              checking={checkingId === monitor.id}
              confirmingRemove={confirmRemove === monitor.id}
              onCheck={() => checkMonitor(monitor.id)}
              onEdit={() => setEditing(monitor)}
              onRemove={() => handleRemove(monitor.id)}
            />
          ))}
        </div>
      </div>

      {(creating || editing) && (
        <Service_Monitor_Modal
          existing={editing}
          saving={saving}
          onSave={(payload) => saveMonitor(payload, editing?.id)}
          onClose={closeModal}
        />
      )}
    </section>
  );
};

export default Service_Monitors;
