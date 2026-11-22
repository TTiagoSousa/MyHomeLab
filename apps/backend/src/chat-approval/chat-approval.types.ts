/** Um email por enviar: o rascunho do Gmail e o que o cartão mostra. */
export interface EmailSendPayload {
  accountEmail: string;
  draftId: string;
  mode: 'new' | 'reply' | 'forward';
  to: string;
  cc?: string;
  subject: string;
  text: string;
  attachments: string[];
  /** Destinatários com quem a conta nunca trocou emails (o cartão avisa). */
  newRecipients: string[];
}

export interface AgentToolChange {
  name: string;
  /** Altera alguma coisa (o cartão marca-a com ⚠). */
  write: boolean;
}

/** Criar, mudar ou apagar um agente: o pedido da ferramenta e o resumo para o cartão. */
export interface AgentChangePayload {
  action: 'create' | 'update' | 'delete';
  agentKey?: string;
  agentName: string;
  /** O que a ferramenta recebeu; volta a validar-se ao aprovar. */
  input: Record<string, unknown>;
  addedTools: AgentToolChange[];
  removedTools: string[];
  promptBefore?: string | null;
  promptAfter?: string | null;
  /** Os outros campos que mudam (nome, descrição, modelo, esforço, chefe, ligado). */
  changes: { field: string; before: string | null; after: string | null }[];
}

/** Instalar uma atualização: passa a Ready to update com o comentário. */
export interface UpdateInstallPayload {
  updateId: string;
  label: string;
  comment: string;
}
