export type ChatApprovalKind = 'EMAIL_SEND' | 'AGENT_CHANGE' | 'UPDATE_INSTALL';

export type ChatApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FAILED';

export interface EmailSendPayload {
  accountEmail: string;
  draftId: string;
  mode: 'new' | 'reply' | 'forward';
  to: string;
  cc?: string;
  subject: string;
  text: string;
  attachments: string[];
  newRecipients: string[];
}

export interface AgentChangePayload {
  action: 'create' | 'update' | 'delete';
  agentKey?: string;
  agentName: string;
  addedTools: { name: string; write: boolean }[];
  removedTools: string[];
  promptBefore?: string | null;
  promptAfter?: string | null;
  changes: { field: string; before: string | null; after: string | null }[];
}

export interface UpdateInstallPayload {
  updateId: string;
  label: string;
  comment: string;
}

interface ChatApprovalBase {
  id: string;
  status: ChatApprovalStatus;
  proposedBy: string;
  result: string | null;
  createdAt: string;
}

export type ChatApproval = ChatApprovalBase &
  (
    | { kind: 'EMAIL_SEND'; payload: EmailSendPayload }
    | { kind: 'AGENT_CHANGE'; payload: AgentChangePayload }
    | { kind: 'UPDATE_INSTALL'; payload: UpdateInstallPayload }
  );
