export interface AiProviderInfo {
  slug: string;
  name: string;
  vendor: string;
  keyPrefix?: string;
}

export const CLAUDE_CODE: AiProviderInfo = {
  slug: 'claude-code',
  name: 'Claude Code',
  vendor: 'Anthropic',
  keyPrefix: 'sk-ant-oat',
};
