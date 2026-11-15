import * as Icon from '../Imports/icons';

export const ASSISTANT_SETTINGS_SECTIONS = [
  { id: 'ai', icon: Icon.Star },
  { id: 'permissions', icon: Icon.Agents },
] as const;

export type AssistantSettingsSection = (typeof ASSISTANT_SETTINGS_SECTIONS)[number]['id'];

export const assistantSettingsPath = (section: AssistantSettingsSection) =>
  `/MyHomeLab/Assistant/Settings?section=${section}`;
