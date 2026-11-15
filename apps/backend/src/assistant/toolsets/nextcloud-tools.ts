import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { listApps, nextcloudTarget, overview } from '../tools/nextcloudTools';

const ACCOUNT = {
  type: 'string' as const,
  description: 'O Nextcloud (nome ou endereço). Omite quando só há um.',
};

// As definições são fixas (a cache vive do prefixo igual); a conta e a password
// só entram nos handlers, que leem apenas as contas deste utilizador.
export function buildNextcloudTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(work: (account: ConnectedAccount, input: T) => Promise<string>) =>
    async (input: T & { account?: string }) => {
      const target = await nextcloudTarget(
        context.connectedAccountRepository,
        context.userId,
        input.account,
      );
      return typeof target === 'string' ? target : work(target, input);
    };

  return [
    {
      name: 'nextcloud_overview',
      description:
        'Resumo do Nextcloud: versão (e se há nova), manutenção, se a conta é admin e quantas apps têm versão nova na App Store.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((account) => overview(account)),
    },
    {
      name: 'nextcloud_list_apps',
      description:
        'As apps ligadas no Nextcloud, com a versão instalada e a mais recente da App Store para esta versão do servidor (precisa de conta admin).',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          only_updates: {
            type: 'boolean',
            description: 'true para listar só as que têm versão nova.',
          },
        },
      },
      handler: run(listApps),
    },
  ];
}
