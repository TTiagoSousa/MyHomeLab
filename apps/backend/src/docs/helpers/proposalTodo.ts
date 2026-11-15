/** A tarefa "Aprovar: …" das propostas antigas (as novas já não a criam: só fecha). */
export const proposalTodoSubject = (proposalId: string) =>
  `doc-proposal:${proposalId}`;

/**
 * O aviso "Aprovar: …" de uma proposta nas Notificações. Leva a tarefa de onde veio,
 * para o aviso a abrir (é lá que se decide); sem tarefa abre Documentos → Propostas.
 */
export const proposalNoticeSubject = (proposalId: string, taskId?: string) =>
  `doc-proposal:${proposalId}${taskId ? `:${taskId}` : ''}`;
