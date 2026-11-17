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

export const CLAUDE_API: AiProviderInfo = {
  slug: 'claude-api',
  name: 'Claude API',
  vendor: 'Anthropic',
  keyPrefix: 'sk-ant-api',
};
