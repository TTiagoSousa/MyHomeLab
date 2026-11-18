import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useServers } from '../../../Hooks/Servers/useServers';
import { useServerCheck } from '../../../Hooks/Servers/useServerCheck';
import { useServerUpdates } from '../../../Hooks/Servers/useServerUpdates';
import { SERVER_KINDS } from '../../../Constants/serverKinds';
import Server_Modal from '../../../Components/Modals/Server_Modal/Server_Modal';
import { Apps_Detail_Header } from './appsShared';
import App_Account from './App_Account';
import App_Updates_Panel from './App_Updates_Panel';
import App_Settings_Menu from './App_Settings_Menu';
import App_Cron_Button from './App_Cron_Button';
import App_Modal from './App_Modal';
import Proxmox_Server_Commands from './Proxmox_Server_Commands';
import Proxmox_Server_Packages from './Proxmox_Server_Packages';
import { appSettingsItems } from './appSettingsItems';
import Linked_Docs from '../../../Components/Linked_Docs/Linked_Docs';
import Agent_Access from '../../../Components/Agent_Access/Agent_Access';
import Linked_Schedules from '../../../Components/Linked_Schedules/Linked_Schedules';
import * as Icon from '../../../Imports/icons';

const Proxmox_Server = () => {
  const { t } = useTranslation('addons');
  const { serverId } = useParams();
  const navigate = useNavigate();
  const { servers, loading, saving, saveServer, removeServer, refreshServers } = useServers();
  const server = servers.find((item) => item.id === serverId);
  const { check, loading: checking, fetchCheck } = useServerCheck(serverId, server?.updatedAt);
  const { updates, loading: loadingUpdates, error: updatesError } = useServerUpdates(serverId);
  const [editing, setEditing] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [linkedServices, setLinkedServices] = useState<string[] | null>(null);
  const [showPackages, setShowPackages] = useState(false);

  const disconnect = async () => {
    if (!server) return;
    const services = await removeServer(server.id, Boolean(linkedServices));
    if (services) {
      setLinkedServices(services);
      return;
    }
    navigate('/MyHomeLab/Apps/Proxmox');
  };

  const pendingCount = updates ? updates.packages.length + (updates.pve ? 1 : 0) : 0;
  const updatesSummary = loadingUpdates
    ? t('apps.loading')
    : updates?.pve
      ? t('apps.proxmox.pveUpdate', { from: updates.pve.from, to: updates.pve.to })
      : updates && updates.packages.length
        ? t('apps.proxmox.packagesSummary', { count: updates.packages.length })
        : updates
          ? t('apps.updates.upToDate')
          : t('apps.proxmox.updatesDescription');

  const settingsItems = [
    {
      id: 'credentials',
      icon: Icon.Profile,
      name: t('apps.appSettings.items.credentials.name'),
      hint: t('apps.appSettings.items.credentials.proxmoxHint'),
      onSelect: () => setEditing(true),
    },
    {
      id: 'commands',
      icon: Icon.Server,
      name: t('apps.proxmox.commands.title'),
      hint: server?.sshEnabled ? t('apps.appSettings.items.commands.onHint') : t('apps.appSettings.items.commands.offHint'),
      onSelect: () => setShowCommands(true),
    },
    ...appSettingsItems(['updates', 'agents', 'docs', 'schedules'], t),
  ];

  return (
    <div className='Apps'>
      <Apps_Detail_Header
        backTo='/MyHomeLab/Apps/Proxmox'
        backLabel={t('apps.proxmox.title')}
        title={server?.name ?? 'Proxmox'}
        actions={
          server && (
            <>
              <button type='button' className='Apps_header_button compact' onClick={() => navigate(`/MyHomeLab/Apps/Proxmox/${serverId}/Connections`)}>
                {t('apps.proxmox.connections.title')}
              </button>
              <App_Cron_Button to={`/MyHomeLab/Apps/Proxmox/${serverId}/Cron`} />
              <App_Settings_Menu items={settingsItems} />
            </>
          )
        }
      />

      {!server ? (
        <p className='Apps_intro'>{loading ? t('apps.loading') : t('apps.proxmox.notFound')}</p>
      ) : (
        <div className='Apps_list'>
          <App_Account
            icon={<Icon.Server />}
            description={t('apps.proxmox.accountDescription')}
            type={t('apps.proxmox.typeName')}
            name={server.name}
            host={`${server.host}:${server.port}`}
            user={server.tokenId}
            userLabel={t('apps.proxmox.token')}
            version={check?.ok ? (check.version ?? null) : null}
            latestVersion={updates?.pve?.to ?? null}
            state={checking ? 'checking' : check ? (check.ok ? 'ok' : 'error') : 'unknown'}
            checking={checking}
            details={
              <>
                {check?.ok && (
                  <>
                    <dt>{t('apps.proxmox.nodes')}</dt>
                    <dd>{check.nodes}</dd>
                    <dt>{t('apps.proxmox.guests')}</dt>
                    <dd>{t('apps.proxmox.guestsValue', { count: check.guests ?? 0, running: check.running })}</dd>
                  </>
                )}
                <dt>{t('apps.proxmox.commands.title')}</dt>
                <dd>{server.sshEnabled ? `${server.sshUser}@${server.host}:${server.sshPort}` : t('apps.proxmox.sshOff')}</dd>
              </>
            }
            footer={
              <div className='Apps_footer'>
                <button type='button' onClick={() => void fetchCheck()} disabled={checking}>
                  {checking ? t('apps.account.checking') : t('apps.account.check')}
                </button>
                {confirming ? (
                  <>
                    <button
                      type='button'
                      onClick={() => {
                        setConfirming(false);
                        setLinkedServices(null);
                      }}
                    >
                      {t('apps.cancel')}
                    </button>
                    <button type='button' className='danger' onClick={() => void disconnect()}>
                      {linkedServices ? t('apps.proxmox.removeAnyway') : t('apps.account.confirmDisconnect')}
                    </button>
                  </>
                ) : (
                  <button type='button' className='danger' onClick={() => setConfirming(true)}>
                    {t('apps.account.disconnect')}
                  </button>
                )}
              </div>
            }
          >
            <p className='Apps_section_note'>{t('apps.proxmox.agentsHint')}</p>
            {check && !check.ok && <p className='Apps_section_note error'>{check.error}</p>}
            {linkedServices && (
              <p className='Apps_section_note error'>{t('apps.proxmox.hasServices', { services: linkedServices.join(', ') })}</p>
            )}
          </App_Account>

          <App_Updates_Panel
            title={t('apps.proxmox.updatesTitle')}
            summary={updatesSummary}
            collapsible={false}
            action={
              <div className='Apps_updates_actions'>
                <span className={`Apps_updates_badge${pendingCount ? ' has' : ''}`}>
                  {pendingCount ? t('apps.updates.count', { count: pendingCount }) : updates ? t('apps.updates.none') : '—'}
                </span>
                {pendingCount > 0 && (
                  <button type='button' className='primary' onClick={() => setShowPackages(true)}>
                    {t('apps.proxmox.viewUpdates')}
                  </button>
                )}
              </div>
            }
          >
            {updatesError && <p className='Apps_section_note error'>{updatesError}</p>}
          </App_Updates_Panel>

          <div id='app-agents'>
            <Agent_Access type='SERVER' targetId={server.id} label={server.name} />
          </div>
          <div id='app-docs'>
            <Linked_Docs type='SERVER' targetId={server.id} label={server.name} />
          </div>
          <div id='app-schedules'>
            <Linked_Schedules type='SERVER' targetId={server.id} label={server.name} />
          </div>
        </div>
      )}

      {showCommands && server && (
        <App_Modal onClose={() => setShowCommands(false)}>
          <Proxmox_Server_Commands server={server} onChanged={refreshServers} />
        </App_Modal>
      )}

      {showPackages && updates && (
        <App_Modal onClose={() => setShowPackages(false)}>
          <Proxmox_Server_Packages updates={updates} />
        </App_Modal>
      )}

      {editing && server && (
        <Server_Modal
          kind={SERVER_KINDS[0]}
          existing={server}
          saving={saving}
          onSave={(payload) => saveServer(payload, server.id)}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
};

export default Proxmox_Server;
