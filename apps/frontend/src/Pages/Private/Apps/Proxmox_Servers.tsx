import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useServers, type ServerEntry } from '../../../Hooks/Servers/useServers';
import { useServerCheck } from '../../../Hooks/Servers/useServerCheck';
import { SERVER_KINDS } from '../../../Constants/serverKinds';
import Server_Modal from '../../../Components/Modals/Server_Modal/Server_Modal';
import { Apps_Account_Card, Apps_Empty_Card, Apps_Page } from './appsShared';

const Proxmox_Server_Card = ({ server }: { server: ServerEntry }) => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { check } = useServerCheck(server.id, server.updatedAt);

  return (
    <Apps_Account_Card
      avatar={server.name}
      title={server.name}
      meta={`${server.host}:${server.port} · ${server.tokenId}`}
      chips={
        <>
          {check?.ok && <span className='Apps_chip'>{t('apps.proxmox.versionChip', { version: check.version })}</span>}
          {check?.ok && <span className='Apps_chip'>{t('apps.proxmox.guestsChip', { count: check.guests ?? 0, running: check.running })}</span>}
          {check && !check.ok && <span className='Apps_chip update'>{t('apps.proxmox.unreachable')}</span>}
        </>
      }
      onOpen={() => navigate(`/MyHomeLab/Apps/Proxmox/${server.id}`)}
    />
  );
};

const Proxmox_Servers = () => {
  const { t } = useTranslation('addons');
  const { servers, saving, saveServer } = useServers();
  const [connecting, setConnecting] = useState(false);

  return (
    <Apps_Page title={t('apps.proxmox.title')} onAdd={() => setConnecting(true)} addLabel={t('apps.proxmox.connect')}>
      {servers.length ? (
        servers.map((server) => <Proxmox_Server_Card key={server.id} server={server} />)
      ) : (
        <Apps_Empty_Card label={t('apps.proxmox.connect')} onAdd={() => setConnecting(true)} />
      )}

      {connecting && (
        <Server_Modal
          kind={SERVER_KINDS[0]}
          existing={null}
          saving={saving}
          onSave={(payload) => saveServer(payload)}
          onClose={() => setConnecting(false)}
        />
      )}
    </Apps_Page>
  );
};

export default Proxmox_Servers;
