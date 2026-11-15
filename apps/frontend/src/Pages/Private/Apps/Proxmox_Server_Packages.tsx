import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Apps_Section } from './appsShared';
import * as Icon from '../../../Imports/icons';
import type { ServerUpdates } from '../../../Hooks/Servers/useServerUpdates';

const PAGE_SIZE = 10;

interface Proxmox_Server_Packages_Props {
  updates: ServerUpdates;
}

const Proxmox_Server_Packages = ({ updates }: Proxmox_Server_Packages_Props) => {
  const { packages } = updates;
  const { t } = useTranslation('addons');
  const [page, setPage] = useState(0);

  const pages = Math.max(1, Math.ceil(packages.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = packages.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <Apps_Section
      icon={<Icon.Server />}
      title={t('apps.proxmox.packagesTitle')}
      description={t('apps.proxmox.packagesSummary', { count: packages.length })}
    >
      {updates.pve && (
        <p className='Apps_section_note update'>{t('apps.proxmox.pveUpdate', { from: updates.pve.from, to: updates.pve.to })}</p>
      )}
      <dl className='Apps_details'>
        {updates.nodes.map((node) => (
          <div key={node.node} className='Apps_details_row'>
            <dt>{node.node}</dt>
            <dd>{node.error ? node.error : t('apps.proxmox.nodeUpdates', { count: node.updates })}</dd>
          </div>
        ))}
      </dl>
      {packages.length > 0 && (
        <div className='Apps_table_scroll'>
          <table className='Apps_table'>
            <thead>
              <tr>
                <th>{t('apps.proxmox.packageName')}</th>
                <th>{t('apps.proxmox.packageFrom')}</th>
                <th>{t('apps.proxmox.packageTo')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.name}>
                  <td className='name'>{item.name}</td>
                  <td>{item.from ?? '—'}</td>
                  <td className='new'>{item.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className='Apps_pager'>
          <button type='button' className='prev' onClick={() => setPage(current - 1)} disabled={current === 0} aria-label={t('apps.proxmox.previousPage')}>
            <Icon.Chevron />
          </button>
          <span>{t('apps.proxmox.page', { page: current + 1, pages })}</span>
          <button type='button' onClick={() => setPage(current + 1)} disabled={current === pages - 1} aria-label={t('apps.proxmox.nextPage')}>
            <Icon.Chevron />
          </button>
        </div>
      )}
      <p className='Apps_section_note'>{t('apps.proxmox.updatesHint')}</p>
    </Apps_Section>
  );
};

export default Proxmox_Server_Packages;
