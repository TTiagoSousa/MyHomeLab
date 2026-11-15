import './Apps.scss';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConnectedAccounts } from '../../../Hooks/ConnectedAccount/useConnectedAccounts';
import { useServers } from '../../../Hooks/Servers/useServers';
import App_Row from './App_Row';
import Apps_Filters, { type Hosting_Filter, type Connection_Filter } from './Apps_Filters';
import Apps_Backups from './Apps_Backups';
import { APP_KINDS, type App_Kind } from './appsCatalog';
import * as Icon from '../../../Imports/icons';
import Page_Help from '../../../Components/Page_Help/Page_Help';

const CATALOG: { kind: App_Kind; descriptionKey: string }[] = [
  { kind: 'NEXTCLOUD', descriptionKey: 'apps.nextcloud.description' },
  { kind: 'GMAIL', descriptionKey: 'apps.gmail.description' },
  { kind: 'GOOGLE_TASKS', descriptionKey: 'apps.googleTasks.description' },
  { kind: 'FORGEJO', descriptionKey: 'apps.forgejo.description' },
  { kind: 'TREK', descriptionKey: 'apps.trek.description' },
  { kind: 'HOME_ASSISTANT', descriptionKey: 'apps.homeAssistant.description' },
  { kind: 'ADGUARD', descriptionKey: 'apps.adguard.description' },
  { kind: 'OPENGYM', descriptionKey: 'apps.openGym.description' },
  { kind: 'PROXMOX', descriptionKey: 'apps.proxmox.description' },
];

const Apps = () => {
  const { t } = useTranslation('addons');
  const navigate = useNavigate();
  const { connectedAccounts } = useConnectedAccounts();
  const { servers } = useServers();
  const [search, setSearch] = useState('');
  const [hosting, setHosting] = useState<Hosting_Filter>('');
  const [connection, setConnection] = useState<Connection_Filter>('');

  const countOf = (appKind: App_Kind) =>
    appKind === 'PROXMOX' ? servers.length : connectedAccounts.filter((account) => account.provider === appKind).length;

  const statusOf = (appKind: App_Kind) => {
    const count = countOf(appKind);
    if (!count) return t('apps.notConnected');
    return appKind === 'PROXMOX' ? t('apps.proxmox.servers', { count }) : t('apps.accounts', { count });
  };

  const words = search.trim().toLowerCase();
  const visible = CATALOG.filter((item) => {
    const appHosting = APP_KINDS[item.kind].hosting;
    if (hosting && appHosting !== hosting && !(appHosting === 'both' && hosting !== 'both')) return false;
    if (connection === 'connected' && !countOf(item.kind)) return false;
    if (connection === 'notConnected' && countOf(item.kind)) return false;
    if (!words) return true;
    return `${t(APP_KINDS[item.kind].titleKey)} ${t(item.descriptionKey)}`.toLowerCase().includes(words);
  });

  return (
    <div className='Apps'>
      <header>
        <div className='Right_Side'>
          <span>{t('page.title')}</span>
          <Page_Help topic='apps' />
        </div>
      </header>

      <p className='Apps_intro'>{t('page.description')}</p>

      <div className='Apps_list'>
        <Apps_Filters search={search} hosting={hosting} connection={connection} onSearch={setSearch} onHosting={setHosting} onConnection={setConnection} />

        <section className='Apps_section Apps_apps'>
          <header className='Apps_catalog_head'>
            <div className='Apps_section_title'>
              <Icon.Plus />
              <div>
                <span>{t('page.catalog.title')}</span>
                <p>{t('page.catalog.description')}</p>
              </div>
            </div>
          </header>
          {visible.map((item) => {
            const KindIcon = APP_KINDS[item.kind].icon;
            return (
              <App_Row
                key={item.kind}
                icon={<KindIcon />}
                name={t(APP_KINDS[item.kind].titleKey)}
                description={t(item.descriptionKey)}
                hosting={t(`page.filters.hosting.${APP_KINDS[item.kind].hosting}`)}
                status={statusOf(item.kind)}
                connected={countOf(item.kind) > 0}
                onOpen={() => navigate(APP_KINDS[item.kind].listPath ?? '/MyHomeLab/Apps')}
              />
            );
          })}
          {visible.length === 0 && <p className='Apps_section_note'>{t('page.filters.noResults')}</p>}
        </section>

        <Apps_Backups />
      </div>
    </div>
  );
};

export default Apps;
