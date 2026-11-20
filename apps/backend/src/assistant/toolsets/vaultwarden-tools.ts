import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import {
  createVaultwardenClient,
  databaseKind,
  MEMBERSHIP_TYPES,
  redactVaultwardenConfig,
  VAULTWARDEN_REPOSITORY,
  VaultwardenClient,
  VaultwardenUser,
  vaultwardenOrganizations,
  vaultwardenVersion,
} from 'src/vaultwarden/vaultwarden.client';
import { latestGithubRelease } from 'src/integrations/releases';

const fold = (text: string) => text.trim().toLowerCase();

const ACCOUNT = {
  type: 'string' as const,
  description: 'O Vaultwarden (nome ou endereço). Omite quando só há um.',
};

const USER = {
  type: 'string' as const,
  description: 'O email do utilizador (ou o id).',
};

/** O Vaultwarden a usar: o único, ou o que bate com o nome ou o endereço. */
export async function vaultwardenTarget(
  context: AgentContext,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await context.connectedAccountRepository.findAllByUser(
      context.userId,
      ConnectionProvider.VAULTWARDEN,
    )
  ).filter(
    (account) => account.isActive && account.baseUrl && account.accessToken,
  );
  if (!accounts.length) {
    return 'Não há nenhum Vaultwarden ligado. Liga-o em Apps ligadas → Vaultwarden.';
  }
  const label = (account: ConnectedAccount) =>
    `${account.displayName ?? 'Vaultwarden'} (${account.baseUrl})`;
  const matches = wanted?.trim()
    ? accounts.filter((account) => fold(label(account)).includes(fold(wanted)))
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o Vaultwarden: ${accounts.map(label).join(', ')}.`;
  }
  return matches[0];
}

/** O utilizador pelo email (ou pelo id). */
async function findUser(
  vault: VaultwardenClient,
  wanted: string,
): Promise<VaultwardenUser> {
  const users = await vault.users();
  const text = fold(wanted ?? '');
  const found = users.find(
    (user) => fold(user.email) === text || user.id === wanted.trim(),
  );
  if (found) return found;
  const partial = users.filter((user) => fold(user.email).includes(text));
  if (partial.length === 1) return partial[0];
  throw new Error(
    partial.length
      ? `há vários: ${partial.map((user) => user.email).join(', ')}`
      : `o Vaultwarden não tem o utilizador «${wanted}»`,
  );
}

const userLine = (user: VaultwardenUser) => {
  const flags = [
    user._status === 1 ? 'convidado (ainda sem conta)' : '',
    user.userEnabled === false ? 'DESATIVADO' : '',
    user._status !== 1 && !user.twoFactorEnabled ? 'sem 2FA' : '',
    user._status !== 1 && user.emailVerified === false
      ? 'email por confirmar'
      : '',
  ].filter(Boolean);
  const orgs = (user.organizations ?? [])
    .map(
      (org) =>
        `${org.name}${org.type !== undefined ? ` (${MEMBERSHIP_TYPES[org.type] ?? org.type})` : ''}`,
    )
    .join(', ');
  return `- ${user.email}${user.name ? ` — ${user.name}` : ''}${flags.length ? ` [${flags.join(', ')}]` : ''}; criado ${user.createdAt ?? '?'}, ativo ${user.lastActive ?? 'nunca'}${orgs ? `; organizações: ${orgs}` : ''}`;
};

export function buildVaultwardenTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(
      work: (
        vault: VaultwardenClient,
        input: T,
        account: ConnectedAccount,
      ) => Promise<string>,
    ) =>
    async (input: T & { account?: string }) => {
      const account = await vaultwardenTarget(context, input.account);
      if (typeof account === 'string') return account;
      try {
        return await work(
          createVaultwardenClient(
            account.baseUrl ?? '',
            account.accessToken ?? '',
          ),
          input,
          account,
        );
      } catch (error) {
        return `Falhou: ${error instanceof Error ? error.message : String(error)}`;
      }
    };

  return [
    {
      name: 'vaultwarden_overview',
      description:
        'O Vaultwarden (o cofre de passwords, compatível com o Bitwarden): a versão e se há nova, quantos utilizadores (ativos, convidados, desativados, sem 2FA), as organizações, a base de dados e o essencial da configuração (registos abertos, convites, email). Os cofres em si estão cifrados com a password mestra de cada um: não se leem.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (vault, _input, account) => {
        const [version, latest, users, config] = await Promise.all([
          vaultwardenVersion(account.baseUrl ?? '').catch(() => '?'),
          latestGithubRelease(VAULTWARDEN_REPOSITORY).catch(() => null),
          vault.users(),
          vault.config().catch(() => null),
        ]);
        const invited = users.filter((user) => user._status === 1);
        const active = users.filter((user) => user._status !== 1);
        const disabled = users.filter((user) => user.userEnabled === false);
        const noTwoFactor = active.filter((user) => !user.twoFactorEnabled);
        const orgs = vaultwardenOrganizations(users);
        const flag = (key: string) =>
          typeof config?.[key] === 'boolean'
            ? config[key]
              ? 'sim'
              : 'não'
            : '?';
        const isNewer =
          latest && version !== '?' && latest.version !== version.slice(1);
        return [
          `Vaultwarden ${version}${isNewer ? ` (a mais recente é a ${latest.version})` : ''}.`,
          `Utilizadores: ${active.length} com conta, ${invited.length} convidados, ${disabled.length} desativados, ${noTwoFactor.length} sem 2FA${noTwoFactor.length ? ` (${noTwoFactor.map((user) => user.email).join(', ')})` : ''}.`,
          `Organizações: ${orgs.length ? orgs.map((org) => `${org.name} (${org.members} membros)`).join(', ') : 'nenhuma'}.`,
          config
            ? `Base de dados: ${databaseKind(config.database_url)}. Registos abertos: ${flag('signups_allowed')}; convites: ${flag('invitations_allowed')}; verificar email no registo: ${flag('signups_verify')}; email (SMTP): ${config.smtp_host ? 'configurado' : 'não'}; cofre web: ${flag('web_vault_enabled')}; notificações push: ${flag('push_enabled')}; Sends: ${flag('sends_allowed')}; acesso de emergência: ${flag('emergency_access_allowed')}.`
            : '',
        ]
          .filter(Boolean)
          .join('\n');
      }),
    },
    {
      name: 'vaultwarden_users',
      description:
        'Os utilizadores do Vaultwarden: email, nome, se têm 2FA, se estão desativados ou só convidados, quando foram criados, a última atividade e as organizações (com o papel). Filtra por texto ou por estado.',
      inputSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Texto no email ou no nome.' },
          filter: {
            type: 'string',
            enum: ['all', 'invited', 'disabled', 'without_2fa'],
          },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (vault, input: { search?: string; filter?: string }) => {
          const found = (await vault.users()).filter((user) => {
            if (
              input.search &&
              !fold(`${user.email} ${user.name ?? ''}`).includes(
                fold(input.search),
              )
            )
              return false;
            if (input.filter === 'invited') return user._status === 1;
            if (input.filter === 'disabled') return user.userEnabled === false;
            if (input.filter === 'without_2fa')
              return user._status !== 1 && !user.twoFactorEnabled;
            return true;
          });
          if (!found.length) return 'Nenhum utilizador.';
          return [
            `${found.length} utilizadores:`,
            ...found.slice(0, 200).map(userLine),
          ].join('\n');
        },
      ),
    },
    {
      name: 'vaultwarden_organizations',
      description:
        'As organizações do Vaultwarden (cofres partilhados): o nome, quantos membros confirmados e os donos.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (vault) => {
        const orgs = vaultwardenOrganizations(await vault.users());
        if (!orgs.length)
          return 'Não há organizações (ou nenhuma tem membros confirmados).';
        return orgs
          .map(
            (org) =>
              `- ${org.name} — ${org.members} membros${org.owners.length ? `; donos: ${org.owners.join(', ')}` : ''} (id ${org.id})`,
          )
          .join('\n');
      }),
    },
    {
      name: 'vaultwarden_invite',
      description:
        'Convida uma pessoa para o Vaultwarden pelo email (com SMTP configurado recebe o convite por email; sem SMTP fica autorizada a criar conta com esse email). Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: { email: { type: 'string' }, account: ACCOUNT },
        required: ['email'],
      },
      handler: run(async (vault, input: { email: string }) => {
        const user = await vault.invite(input.email);
        return `Convidei ${user?.email ?? input.email}. Fica como convidado até criar a conta.`;
      }),
    },
    {
      name: 'vaultwarden_user_action',
      description:
        'Muda um utilizador do Vaultwarden: disable (desativa e termina as sessões; não apaga nada), enable (volta a ativar), deauth (termina as sessões em todos os dispositivos: tem de voltar a entrar), remove_2fa (tira o 2FA, para quem perdeu o telemóvel) ou resend_invite (reenvia o convite a quem ainda não criou conta). Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          user: USER,
          action: {
            type: 'string',
            enum: [
              'disable',
              'enable',
              'deauth',
              'remove_2fa',
              'resend_invite',
            ],
          },
          account: ACCOUNT,
        },
        required: ['user', 'action'],
      },
      handler: run(async (vault, input: { user: string; action: string }) => {
        const user = await findUser(vault, input.user);
        switch (input.action) {
          case 'disable':
            await vault.disable(user.id);
            return `Desativei ${user.email} (as sessões dele terminaram).`;
          case 'enable':
            await vault.enable(user.id);
            return `Ativei ${user.email}.`;
          case 'deauth':
            await vault.deauth(user.id);
            return `Terminei as sessões de ${user.email} em todos os dispositivos.`;
          case 'remove_2fa':
            await vault.removeTwoFactor(user.id);
            return `Tirei o 2FA a ${user.email}. Lembra-o de o voltar a pôr.`;
          case 'resend_invite':
            await vault.resendInvite(user.id);
            return `Reenviei o convite a ${user.email}.`;
          default:
            return 'Ação desconhecida.';
        }
      }),
    },
    {
      name: 'vaultwarden_delete_user',
      description:
        'Apaga um utilizador do Vaultwarden com o cofre dele todo (não se desfaz: as passwords dele perdem-se). Prefere vaultwarden_user_action com disable. Confirma com ele antes, dizendo o email.',
      inputSchema: {
        type: 'object',
        properties: { user: USER, account: ACCOUNT },
        required: ['user'],
      },
      handler: run(async (vault, input: { user: string }) => {
        const user = await findUser(vault, input.user);
        await vault.deleteUser(user.id);
        return `Apaguei ${user.email} e o cofre dele.`;
      }),
    },
    {
      name: 'vaultwarden_config',
      description:
        'A configuração em vigor no Vaultwarden (domínio, registos, convites, SMTP, 2FA, limites, etc.), com os segredos escondidos. Filtra pelo nome da chave. Só leitura: mudar a configuração faz-se no painel /admin ou nas variáveis de ambiente.',
      inputSchema: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Parte do nome da chave, ex.: "smtp" ou "signups".',
          },
          account: ACCOUNT,
        },
      },
      handler: run(async (vault, input: { search?: string }) => {
        const config = redactVaultwardenConfig(await vault.config());
        const entries = Object.entries(config).filter(
          ([key]) => !input.search || key.includes(fold(input.search)),
        );
        if (!entries.length) return 'Nenhuma chave com esse nome.';
        return entries
          .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
          .join('\n');
      }),
    },
    {
      name: 'vaultwarden_backup_db',
      description:
        'Pede ao Vaultwarden uma cópia da base de dados SQLite para a pasta data do servidor (só funciona com SQLite). Útil antes de uma atualização. Faz só quando ele pedir.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (vault) => {
        const result = await vault.backupDatabase();
        return typeof result === 'string' && result
          ? `Feito: ${result}`
          : 'Feito: a cópia ficou na pasta data do Vaultwarden.';
      }),
    },
    {
      name: 'vaultwarden_test_smtp',
      description:
        'Manda um email de teste pelo SMTP do Vaultwarden, para confirmar que os convites e os avisos chegam. Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: { email: { type: 'string' }, account: ACCOUNT },
        required: ['email'],
      },
      handler: run(async (vault, input: { email: string }) => {
        await vault.testSmtp(input.email);
        return `Mandei um email de teste para ${input.email}.`;
      }),
    },
  ];
}
