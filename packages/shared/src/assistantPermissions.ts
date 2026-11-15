/** Ler (consultar) ou escrever (criar, mudar, apagar, correr). */
export type AssistantAccess = 'read' | 'write';

export type AssistantPermissionGroup =
  | 'email'
  | 'organization'
  | 'health'
  | 'servers'
  | 'development'
  | 'home'
  | 'assistant';

export interface AssistantPermissionArea {
  key: string;
  group: AssistantPermissionGroup;
  access: readonly AssistantAccess[];
}

/**
 * O que o Jarvis pode fazer, por área. Cada área tem leitura e/ou escrita; o
 * utilizador desliga o que não quer e as ferramentas dessa área passam a
 * recusar. Por omissão está tudo ligado.
 */
export const ASSISTANT_PERMISSION_AREAS: readonly AssistantPermissionArea[] = [
  { key: 'email', group: 'email', access: ['read'] },
  { key: 'emailRules', group: 'email', access: ['read', 'write'] },
  { key: 'todos', group: 'organization', access: ['read', 'write'] },
  { key: 'healthSleep', group: 'health', access: ['read'] },
  { key: 'healthVitals', group: 'health', access: ['read', 'write'] },
  { key: 'healthActivity', group: 'health', access: ['read', 'write'] },
  { key: 'healthBody', group: 'health', access: ['read', 'write'] },
  { key: 'healthNutrition', group: 'health', access: ['read', 'write'] },
  { key: 'healthMedical', group: 'health', access: ['read', 'write'] },
  { key: 'healthJournal', group: 'health', access: ['read', 'write'] },
  { key: 'opengym', group: 'health', access: ['read', 'write'] },
  { key: 'trek', group: 'organization', access: ['read', 'write'] },
  { key: 'servers', group: 'servers', access: ['read', 'write'] },
  { key: 'backups', group: 'servers', access: ['read', 'write'] },
  { key: 'serverControl', group: 'servers', access: ['read', 'write'] },
  { key: 'serverShell', group: 'servers', access: ['read', 'write'] },
  { key: 'updates', group: 'servers', access: ['read', 'write'] },
  { key: 'adguard', group: 'servers', access: ['read', 'write'] },
  { key: 'nextcloud', group: 'servers', access: ['read'] },
  { key: 'forgejo', group: 'development', access: ['read', 'write'] },
  { key: 'homeAssistant', group: 'home', access: ['read', 'write'] },
  { key: 'team', group: 'assistant', access: ['read', 'write'] },
  { key: 'prompts', group: 'assistant', access: ['read', 'write'] },
  { key: 'docs', group: 'assistant', access: ['read', 'write'] },
  { key: 'schedules', group: 'assistant', access: ['read', 'write'] },
  { key: 'board', group: 'assistant', access: ['read', 'write'] },
];

/** "health.write" — a forma como uma permissão desligada fica guardada. */
export const assistantPermissionKey = (area: string, access: AssistantAccess) =>
  `${area}.${access}`;

export const ASSISTANT_PERMISSION_KEYS = ASSISTANT_PERMISSION_AREAS.flatMap(
  (area) => area.access.map((access) => assistantPermissionKey(area.key, access)),
);
