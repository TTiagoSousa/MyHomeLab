import type { ComponentType } from 'react';
import * as Icon from '../../../Imports/icons';

export type MenuGroup = 'daily' | 'lab' | 'jarvis' | 'personal' | 'system';

interface MenuItem {
  id: string;
  labelKey: string;
  hintKey: string;
  group: MenuGroup;
  icon: ComponentType<{ color?: string }>;
  path?: string;
  subItems?: { id: string; labelKey: string; path?: string }[];
  adminOnly?: boolean;
  serversOnly?: boolean;
}

export const menuGroups: MenuGroup[] = ['daily', 'lab', 'jarvis', 'personal', 'system'];

export const menuItems: MenuItem[] = [
  {
    id: 'today',
    labelKey: 'menu.today',
    hintKey: 'hints.today',
    group: 'daily',
    icon: Icon.Sun,
    path: '/MyHomeLab/Today'
  },
  {
    id: 'tasks',
    labelKey: 'menu.tasks',
    hintKey: 'hints.tasks',
    group: 'daily',
    icon: Icon.Checklist,
    path: '/MyHomeLab/Tasks'
  },
  {
    id: 'notifications',
    labelKey: 'menu.notifications',
    hintKey: 'hints.notifications',
    group: 'daily',
    icon: Icon.Bell,
    path: '/MyHomeLab/Notifications'
  },
  {
    id: 'services',
    labelKey: 'menu.services',
    hintKey: 'hints.services',
    group: 'lab',
    icon: Icon.Grid,
    path: '/MyHomeLab/Services'
  },
  {
    id: 'servers',
    labelKey: 'menu.servers',
    hintKey: 'hints.servers',
    group: 'lab',
    icon: Icon.Server,
    path: '/MyHomeLab/Servers',
    serversOnly: true
  },
  {
    id: 'apps',
    labelKey: 'menu.addons',
    hintKey: 'hints.addons',
    group: 'lab',
    icon: Icon.World,
    path: '/MyHomeLab/Apps'
  },
  {
    id: 'assistant',
    labelKey: 'menu.assistant',
    hintKey: 'hints.assistant',
    group: 'jarvis',
    icon: Icon.Chat,
    path: '/MyHomeLab/Assistant'
  },
  {
    id: 'projects',
    labelKey: 'menu.projects',
    hintKey: 'hints.projects',
    group: 'jarvis',
    icon: Icon.Board,
    path: '/MyHomeLab/Projects'
  },
  {
    id: 'docs',
    labelKey: 'menu.docs',
    hintKey: 'hints.docs',
    group: 'jarvis',
    icon: Icon.Doc,
    path: '/MyHomeLab/Docs'
  },
  {
    id: 'health',
    labelKey: 'menu.health',
    hintKey: 'hints.health',
    group: 'personal',
    icon: Icon.Heart,
    path: '/MyHomeLab/Health'
  },
  {
    id: 'defenições',
    labelKey: 'menu.settings',
    hintKey: 'hints.settings',
    group: 'system',
    icon: Icon.Settings,
    path: '/MyHomeLab/Defeniçoes'
  },
  {
    id: 'admin',
    labelKey: 'menu.admin',
    hintKey: 'hints.admin',
    group: 'system',
    icon: Icon.Profile,
    path: '/MyHomeLab/Admin',
    adminOnly: true
  },
  {
    id: 'help',
    labelKey: 'menu.help',
    hintKey: 'hints.help',
    group: 'system',
    icon: Icon.Help,
    path: '/MyHomeLab/Help'
  },
];
