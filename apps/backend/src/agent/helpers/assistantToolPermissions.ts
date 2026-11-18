import { AssistantAccess, assistantPermissionKey } from '@myhomelab/shared';
import { AgentTool } from 'src/assistant/claude-agent.client';
import { AccessTarget, appAccessBlock } from './appAccess';

type Requirement = [area: string, access: AssistantAccess];

const read = (area: string): Requirement => [area, 'read'];
const write = (area: string): Requirement => [area, 'write'];

/** As ferramentas que leem ou escrevem sempre na mesma área. */
const FIXED: Record<string, Requirement> = {
  summarize_emails_today: read('email'),
  search_emails: read('email'),
  list_connected_emails: read('email'),
  analyze_inbox: read('email'),
  list_email_rules: read('emailRules'),
  get_proposal_settings: read('emailRules'),
  list_email_proposals: read('emailRules'),
  create_email_rule: write('emailRules'),
  update_email_rule: write('emailRules'),
  delete_email_rule: write('emailRules'),
  set_proposal_settings: write('emailRules'),
  analyze_email_proposals: write('emailRules'),
  implement_email_proposal: write('emailRules'),
  dismiss_email_proposal: write('emailRules'),

  todo_lists: read('todos'),
  todo_list: read('todos'),
  todo_create: write('todos'),
  todo_update: write('todos'),
  todo_delete: write('todos'),
  todo_create_list: write('todos'),

  list_service_monitors: read('servers'),
  check_service_monitor: read('servers'),
  list_notifications: read('servers'),
  disk_health: read('servers'),
  list_servers: read('servers'),
  list_proxmox_guests: read('servers'),
  get_guest_status: read('servers'),
  check_service_status: read('servers'),
  list_backups: read('backups'),

  pve_guest_config: read('serverControl'),
  pve_list_snapshots: read('serverControl'),
  pve_guest_power: write('serverControl'),
  pve_create_snapshot: write('serverControl'),
  pve_rollback_snapshot: write('serverControl'),
  pve_delete_snapshot: write('serverControl'),
  pve_backup_now: write('serverControl'),
  pve_set_resources: write('serverControl'),
  disk_alert_get: read('serverControl'),
  disk_alert_save_study: write('serverControl'),
  disk_alert_grow: write('serverControl'),
  disk_alert_ask: write('serverControl'),
  disk_alert_done: write('serverControl'),

  docs_search: read('docs'),
  docs_projects: read('docs'),
  docs_layout: read('docs'),
  docs_targets: read('docs'),
  docs_read: read('docs'),
  docs_write: write('docs'),
  docs_log: write('docs'),
  docs_propose: write('docs'),

  updates_list: read('updates'),
  update_status: read('updates'),
  update_release_notes: read('updates'),
  update_list_new: read('updates'),
  update_start: write('updates'),
  update_known_issues: read('updates'),
  update_save_study: write('updates'),
  update_set_status: write('updates'),
  update_add_note: write('updates'),
  update_prepare: write('updates'),
  update_verify: write('updates'),
  update_run: write('updates'),
  update_check: write('updates'),
  board_list: read('board'),
  board_get: read('board'),
  board_create: write('board'),
  board_update: write('board'),
  board_comment: write('board'),
  board_ask_user: write('board'),
  update_attempt_close: write('updates'),

  schedule_list: read('schedules'),
  schedule_create: write('schedules'),
  schedule_update: write('schedules'),
  schedule_delete: write('schedules'),

  server_command_history: read('serverShell'),
  server_inventory: read('serverShell'),
  server_run_command: write('serverShell'),
  run_backup: write('backups'),

  forgejo_list_repos: read('forgejo'),
  forgejo_list_issues: read('forgejo'),
  forgejo_get_issue: read('forgejo'),
  forgejo_list_releases: read('forgejo'),
  forgejo_list_commits: read('forgejo'),
  forgejo_list_action_runs: read('forgejo'),
  forgejo_create_issue: write('forgejo'),
  forgejo_comment_issue: write('forgejo'),
  forgejo_set_issue_state: write('forgejo'),

  ha_overview: read('homeAssistant'),
  ha_list_updates: read('homeAssistant'),
  ha_list_entities: read('homeAssistant'),
  ha_get_entity: read('homeAssistant'),
  ha_list_services: read('homeAssistant'),
  ha_list_configs: read('homeAssistant'),
  ha_get_config: read('homeAssistant'),
  ha_system_log: read('homeAssistant'),
  ha_call_service: write('homeAssistant'),
  ha_save_config: write('homeAssistant'),
  ha_delete_config: write('homeAssistant'),
  ha_update_entity: write('homeAssistant'),
  nextcloud_overview: read('nextcloud'),
  nextcloud_list_apps: read('nextcloud'),
  opengym_overview: read('opengym'),
  trek_overview: read('trek'),
  trek_tools: read('trek'),
  trek_tool_help: read('trek'),
  trek_read: read('trek'),
  trek_write: write('trek'),
  opengym_search_exercises: read('opengym'),
  opengym_list_routines: read('opengym'),
  opengym_create_routine: write('opengym'),
  opengym_schedule_week: write('opengym'),
  opengym_update_routine: write('opengym'),
  opengym_delete_routine: write('opengym'),
  gametracker_overview: read('gametracker'),
  gametracker_shelf: read('gametracker'),
  gametracker_search: read('gametracker'),
  gametracker_game: read('gametracker'),
  gametracker_watchlist: read('gametracker'),
  gametracker_set_game: write('gametracker'),
  gametracker_remove_game: write('gametracker'),
  gametracker_watch_price: write('gametracker'),
  immich_overview: read('immich'),
  immich_search: read('immich'),
  immich_albums: read('immich'),
  immich_album: read('immich'),
  immich_people: read('immich'),
  immich_duplicates: read('immich'),
  immich_queues: read('immich'),
  immich_settings: read('immich'),
  immich_save_album: write('immich'),
  immich_update_person: write('immich'),
  immich_run_job: write('immich'),
  immich_set_settings: write('immich'),
  paperless_overview: read('paperless'),
  paperless_search: read('paperless'),
  paperless_document: read('paperless'),
  paperless_metadata: read('paperless'),
  paperless_tasks: read('paperless'),
  paperless_automations: read('paperless'),
  paperless_settings: read('paperless'),
  paperless_update_document: write('paperless'),
  paperless_bulk_edit: write('paperless'),
  paperless_save_object: write('paperless'),
  paperless_set_settings: write('paperless'),
  solidtime_overview: read('solidtime'),
  solidtime_entries: read('solidtime'),
  solidtime_report: read('solidtime'),
  solidtime_catalog: read('solidtime'),
  solidtime_start_timer: write('solidtime'),
  solidtime_stop_timer: write('solidtime'),
  solidtime_save_entry: write('solidtime'),
  solidtime_save_object: write('solidtime'),
  adguard_overview: read('adguard'),
  adguard_query_log: read('adguard'),
  adguard_check_domain: read('adguard'),
  adguard_list_filters: read('adguard'),
  adguard_get_settings: read('adguard'),
  adguard_set_protection: write('adguard'),
  adguard_set_domain_rule: write('adguard'),
  adguard_set_user_rules: write('adguard'),
  adguard_manage_filter: write('adguard'),
  adguard_refresh_filters: write('adguard'),
  adguard_set_filter_interval: write('adguard'),
  adguard_manage_rewrite: write('adguard'),
  adguard_set_blocked_services: write('adguard'),

  list_team: read('team'),
  list_available_tools: read('team'),
  create_agent: write('team'),
  update_agent: write('team'),
  delete_agent: write('team'),
  list_agent_prompts: read('prompts'),
  propose_agent_prompt: write('prompts'),
  apply_agent_prompt: write('prompts'),
  discard_agent_prompt: write('prompts'),
};

/** Em que área da saúde cai cada métrica (leitura) e cada tipo de registo (escrita). */
const HEALTH_AREA: Record<string, string> = {
  sleep: 'healthSleep',
  heart_rate: 'healthVitals',
  skin_temperature: 'healthVitals',
  blood_oxygen: 'healthVitals',
  stress: 'healthVitals',
  vitals: 'healthVitals',
  vital: 'healthVitals',
  steps: 'healthActivity',
  exercise: 'healthActivity',
  training: 'healthActivity',
  workout: 'healthActivity',
  weight: 'healthBody',
  body: 'healthBody',
  profile: 'healthBody',
  water: 'healthNutrition',
  nutrition: 'healthNutrition',
  meal: 'healthNutrition',
  intakes: 'healthNutrition',
  intake: 'healthNutrition',
  fasting: 'healthNutrition',
  fast: 'healthNutrition',
  fast_start: 'healthNutrition',
  fast_end: 'healthNutrition',
  labs: 'healthMedical',
  medication: 'healthMedical',
  medical: 'healthMedical',
  condition: 'healthMedical',
  diary: 'healthJournal',
  mood: 'healthJournal',
};

/** O resumo e o detalhe mostram sono, sinais vitais e atividade juntos. */
const HEALTH_SUMMARY: Requirement[] = [
  read('healthSleep'),
  read('healthVitals'),
  read('healthActivity'),
];

/** O que uma chamada precisa. Ferramentas sem área (os subagentes) não precisam de nada. */
export function toolRequirements(
  toolName: string,
  input: unknown,
): Requirement[] {
  const fixed = FIXED[toolName];
  if (fixed) return [fixed];

  const fields = (input ?? {}) as { metric?: string; kind?: string };
  if (toolName === 'health_overview' || toolName === 'health_detail') {
    return HEALTH_SUMMARY;
  }
  if (toolName === 'health_metric') {
    const area = HEALTH_AREA[fields.metric ?? ''];
    return area ? [read(area)] : HEALTH_SUMMARY;
  }
  if (toolName === 'health_log' || toolName === 'health_change') {
    const area = HEALTH_AREA[fields.kind ?? ''];
    return area ? [write(area)] : [];
  }
  return [];
}

/**
 * Tira ao modelo o que o utilizador desligou em Assistente → Definições →
 * Permissões. As definições das ferramentas ficam iguais (a cache vive do
 * prefixo); só o handler passa a recusar, e o modelo explica-o.
 */
export function guardTools(
  tools: AgentTool[],
  denied: string[],
  access?: { agentKey: string; targets: () => Promise<AccessTarget[]> },
): AgentTool[] {
  if (!denied.length && !access) return tools;
  return tools.map((tool) => ({
    ...tool,
    handler: async (input: unknown) => {
      if (access) {
        const blocked = appAccessBlock(
          tool.name,
          input,
          access.agentKey,
          await access.targets(),
        );
        if (blocked) return blocked;
      }
      const blocked = toolRequirements(tool.name, input).find(
        ([area, access]) =>
          denied.includes(assistantPermissionKey(area, access)),
      );
      if (blocked) {
        const what = blocked[1] === 'read' ? 'ler' : 'alterar';
        return (
          `Sem permissão: o utilizador não deixa o Jarvis ${what} isto (${blocked[0]}). ` +
          'Diz-lhe que pode ligar em Assistente → Definições → Permissões.'
        );
      }
      return tool.handler(input);
    },
  }));
}
