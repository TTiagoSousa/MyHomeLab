import type { ComponentType } from 'react';
import type { TFunction } from 'i18next';
import type { App_Settings_Item } from './App_Settings_Menu';
import { scrollToSection } from './appsCatalog';
import * as Icon from '../../../Imports/icons';

export type App_Settings_Section =
  | 'account'
  | 'location'
  | 'rules'
  | 'proposals'
  | 'updates'
  | 'backups'
  | 'agents'
  | 'docs'
  | 'schedules';

const SECTION_ICONS: Record<App_Settings_Section, ComponentType> = {
  account: Icon.Profile,
  location: Icon.Server,
  rules: Icon.Doc,
  proposals: Icon.Star,
  updates: Icon.Refresh,
  backups: Icon.Folder,
  agents: Icon.Agents,
  docs: Icon.Doc,
  schedules: Icon.Clock,
};

export const sectionAnchor = (section: App_Settings_Section) => `app-${section}`;

export const appSettingsItems = (sections: App_Settings_Section[], t: TFunction, credentialsHint?: string): App_Settings_Item[] =>
  sections.map((section) => ({
    id: section,
    icon: SECTION_ICONS[section],
    name: t(`addons:apps.appSettings.items.${section}.name`),
    hint: section === 'account' && credentialsHint ? credentialsHint : t(`addons:apps.appSettings.items.${section}.hint`),
    onSelect: () => scrollToSection(sectionAnchor(section)),
  }));
