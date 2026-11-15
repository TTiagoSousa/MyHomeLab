import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import './Servers.scss';
import { useServers } from '../../../Hooks/Servers/useServers';
import { useServerDashboard } from '../../../Hooks/Servers/useServerDashboard';
import { dateLocale } from '../../../i18n';
import * as Icon from '../../../Imports/icons';
import Server_View from './Server_View';
import Page_Help from '../../../Components/Page_Help/Page_Help';

const SELECTED_SERVER_KEY = 'servers.selected';

const Servers = () => {
  const { t } = useTranslation('servers');
  const navigate = useNavigate();
  const { servers, loading: loadingServers } = useServers();
  const [selectedId, setSelectedId] = useState(localStorage.getItem(SELECTED_SERVER_KEY));

  const selected = servers.find((server) => server.id === selectedId) ?? servers[0];
  const { dashboard, loading, error, fetchDashboard } = useServerDashboard(selected?.id ?? null);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    localStorage.setItem(SELECTED_SERVER_KEY, id);
  };

  const openSettings = () => navigate('/MyHomeLab/Apps/Proxmox');

  const updatedAt = dashboard
    ? new Date(dashboard.fetchedAt).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className='Servers'>
      <header>
        <div className='Right_Side'>
          <span>{t('title')}</span>
          <Page_Help topic='proxmox' />
        </div>

        <div className='Left_Side'>
          {selected && (
            <button
              type='button'
              className={`Servers_icon_button${loading ? ' spinning' : ''}`}
              onClick={fetchDashboard}
              title={t('refresh')}
            >
              <Icon.Refresh />
            </button>
          )}
          <button type='button' className='Servers_manage' onClick={openSettings}>
            {t('manage')}
          </button>
        </div>
      </header>

      {!loadingServers && servers.length === 0 && (
        <div className='Servers_empty'>
          <span className='Servers_empty_title'>{t('empty.title')}</span>
          <span>{t('empty.text')}</span>
          <button type='button' onClick={openSettings}>
            {t('empty.action')}
          </button>
        </div>
      )}

      {servers.length > 0 && (
        <div className='Servers_tabs'>
          {servers.map((server) => (
            <button
              key={server.id}
              type='button'
              className={server.id === selected?.id ? 'active' : ''}
              onClick={() => handleSelect(server.id)}
            >
              <Icon.Server />
              <span className='Servers_tab_name'>{server.name}</span>
              <span className='Servers_tab_host'>{server.host}:{server.port}</span>
            </button>
          ))}
        </div>
      )}

      {updatedAt && <span className='Servers_updated'>{t('updated', { time: updatedAt })}</span>}

      {error && (
        <div className='Servers_error'>
          <strong>{t('error.title')}</strong>
          <span>{error}</span>
        </div>
      )}

      {selected && !dashboard && !error && <div className='Servers_loading'>{t('loading')}</div>}

      {dashboard && <Server_View key={selected?.id} serverId={selected!.id} dashboard={dashboard} />}
    </div>
  );
};

export default Servers;
