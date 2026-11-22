import { isWriteTool } from './assistantToolPermissions';

/**
 * As escritas que não mexem no servidor, nas apps nem no email: registar, comentar,
 * perguntar, propor. Não precisam de ler os documentos primeiro (são o que se faz
 * quando ainda não se sabe o que as regras dizem).
 */
const WITHOUT_READING = new Set([
  'board_comment',
  'board_ask_user',
  'docs_log',
  'docs_propose',
  'docs_write',
  'docs_decide',
  'update_add_note',
  'approval_decide',
  'propose_agent_prompt',
  'discard_agent_prompt',
  'analyze_email_proposals',
  'dismiss_email_proposal',
  'disk_alert_ask',
  'disk_alert_save_study',
]);

/**
 * Antes desta ferramenta, o agente tem de ter lido (docs_read) os documentos do que o
 * pedido toca. Sai das escritas do catálogo de permissões: uma ferramenta nova que
 * altere fica logo aqui, sem uma lista à mão para esquecer.
 */
export function needsDocsFirst(toolName: string): boolean {
  return isWriteTool(toolName) && !WITHOUT_READING.has(toolName);
}
