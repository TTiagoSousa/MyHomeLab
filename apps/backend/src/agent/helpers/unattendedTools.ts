import { classifyCommand } from 'src/server-connection/helpers/commandSafety';

/**
 * Sem ele a ver (um disparo, um estudo, uma instalação), o prompt não chega para travar
 * uma escrita: um email ou uma página lida pode levar o agente a fazer outra coisa. Aqui
 * fica, em código, o que cada origem pode alterar. O chat e o terminal não têm limite
 * (é ele a pedir); as leituras passam sempre.
 */

/** O que nunca se faz sem ele: enviar, mexer na equipa, nos disparos dele, apagar. */
const NEVER = new Set([
  'send_email_draft',
  'approval_decide',
  'create_agent',
  'update_agent',
  'delete_agent',
  'propose_agent_prompt',
  'apply_agent_prompt',
  'discard_agent_prompt',
  'schedule_update',
  'schedule_delete',
  'docs_decide',
  'trash_email',
  'todo_delete',
  'delete_email_rule',
  'vaultwarden_delete_user',
  'infisical_secret_delete',
  'nginx_proxy_manager_delete_host',
  'dispatcharr_channel_delete',
  'pve_delete_snapshot',
  'ha_delete_config',
  'gametracker_remove_game',
  'opengym_delete_routine',
]);

/** Um disparo: comentar, perguntar, registar, propor, preparar um rascunho. */
const SCHEDULE = new Set([
  'board_comment',
  'board_ask_user',
  'board_update',
  'board_create',
  'docs_log',
  'docs_propose',
  'docs_write',
  'update_add_note',
  'update_set_status',
  'draft_email',
  'todo_create',
  'todo_update',
  'analyze_email_proposals',
  'disk_alert_save_study',
  'disk_alert_ask',
  'disk_alert_done',
  'schedule_create',
  'server_run_command',
]);

/** Um estudo de atualização: o de um disparo e gravar o estudo. */
const STUDY = new Set([...SCHEDULE, 'update_save_study', 'update_check']);

/** O comando que um disparo pode correr sem ele: leituras e reiniciar um serviço. */
const RESTART_SERVICE =
  /^(?:pct exec \d+ -- )?systemctl restart [\w@.-]+(?:\.service)?$/;

export function unattendedCommandAllowed(command: string): boolean {
  const text = command.trim().replace(/\s+/g, ' ');
  return classifyCommand(text) === 'read' || RESTART_SERVICE.test(text);
}

/**
 * Porque é que esta escrita não corre aqui (o texto vai para o modelo), ou null.
 * `write`: a ferramenta altera alguma coisa (as leituras nunca chegam aqui).
 */
export function unattendedBlock(
  toolName: string,
  input: unknown,
  source: string | undefined,
  write: boolean,
): string | null {
  if (!source || source === 'chat' || source === 'terminal') return null;
  const refuse =
    'Recusado: sem ele a ver, isto precisa do sim dele. Pergunta-lhe com board_ask_user (ou diz-lho no aviso) e deixa para quando ele responder.';
  if (NEVER.has(toolName)) return refuse;
  if (!write) return null;
  // Uma instalação ou uma verificação já foram aprovadas por ele: corre o que for
  // preciso, menos o que nunca se faz sem ele.
  if (source === 'install' || source === 'verify') return null;
  const allowed = source === 'study' ? STUDY : SCHEDULE;
  if (!allowed.has(toolName)) return refuse;
  if (toolName === 'server_run_command') {
    const command = (input as { command?: string } | null)?.command ?? '';
    if (!unattendedCommandAllowed(command)) {
      return 'Recusado: sem ele a ver, só correm leituras e "systemctl restart <serviço>". Para o resto, pergunta-lhe com board_ask_user.';
    }
  }
  return null;
}
