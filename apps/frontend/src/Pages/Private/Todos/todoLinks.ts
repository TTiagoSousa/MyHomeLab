import i18n from '../../../i18n';

const SITE_PAGES: [prefix: string, key: string][] = [
  ['/MyHomeLab/Projects/', 'projectTask'],
  ['/MyHomeLab/Projects', 'projects'],
  ['/MyHomeLab/Tasks', 'tasks'],
  ['/MyHomeLab/Notifications', 'notifications'],
  ['/MyHomeLab/Docs', 'docs'],
  ['/MyHomeLab/Apps', 'apps'],
  ['/MyHomeLab/Servers', 'servers'],
  ['/MyHomeLab/Assistant', 'assistant'],
  ['/MyHomeLab/Health', 'health'],
];

export const linkLabel = (link: string) => {
  if (link.startsWith('/')) {
    const page = SITE_PAGES.find(([prefix]) => link.startsWith(prefix));
    return page ? i18n.t(`todos:linkLabels.${page[1]}`) : link;
  }
  try {
    return new URL(link).host;
  } catch {
    return link;
  }
};
