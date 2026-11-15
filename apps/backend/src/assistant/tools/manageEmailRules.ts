import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { PrismaEmailRuleRepository } from 'src/email-rule/repositories/prisma/prisma-email-rule-repository';
import { createEmailRule } from 'src/email-rule/helpers/createEmailRule';
import { findAllEmailRules } from 'src/email-rule/helpers/findAllEmailRules';
import { updateEmailRule } from 'src/email-rule/helpers/updateEmailRule';
import { deleteEmailRule } from 'src/email-rule/helpers/deleteEmailRule';
import { CreateEmailRuleDto } from 'src/email-rule/dto/create-email-rule.dto';
import { UpdateEmailRuleDto } from 'src/email-rule/dto/update-email-rule.dto';
import { ConnectionProvider } from 'src/generated/prisma/client/client';

/**
 * As ferramentas de regras falam por email da conta, não por id — o agente nunca vê
 * uuids, e o utilizador também não os escreve numa conversa. A tradução acontece aqui.
 */
export async function resolveAccount(
  accountEmail: string | undefined,
  repository: PrismaConnectedAccountRepository,
  userId: string,
) {
  const accounts = (await repository.findAllActiveByUser(userId)).filter(
    (account) => account.provider === ConnectionProvider.GMAIL,
  );

  if (accounts.length === 0) {
    throw new Error('Não há nenhuma conta Gmail ligada.');
  }

  if (!accountEmail) {
    if (accounts.length === 1) return accounts[0];
    throw new Error(
      `Há mais que uma conta Gmail ligada (${accounts
        .map((account) => account.emailAddress)
        .join(', ')}). Diz qual delas.`,
    );
  }

  const match = accounts.find(
    (account) =>
      account.emailAddress?.toLowerCase() === accountEmail.toLowerCase(),
  );
  if (!match) {
    throw new Error(
      `Não há nenhuma conta Gmail ligada com o email ${accountEmail}.`,
    );
  }
  return match;
}

export function describeRule(rule: {
  name: string;
  isActive: boolean;
  fromContains: string[];
  subjectContains: string[];
  keywords: string[];
  mailKind: string;
  markAsRead: boolean;
  markAsImportant: boolean;
  markAsStarred: boolean;
  removeFromInbox: boolean;
  labelPaths: { path: string; labelMode: string }[];
}): string {
  const conditions: string[] = [];
  if (rule.fromContains.length)
    conditions.push(`de ${rule.fromContains.join(' ou ')}`);
  if (rule.subjectContains.length)
    conditions.push(`assunto com ${rule.subjectContains.join(' ou ')}`);
  if (rule.keywords.length)
    conditions.push(`palavras ${rule.keywords.join(' ou ')}`);
  if (rule.mailKind === 'BULK') conditions.push('só publicidade e newsletters');
  if (rule.mailKind === 'DIRECT')
    conditions.push('sem publicidade nem newsletters');

  const actions: string[] = [];
  if (rule.labelPaths.length)
    actions.push(
      `marcadores ${rule.labelPaths
        .map((entry) => `${entry.path} (${entry.labelMode})`)
        .join(', ')}`,
    );
  if (rule.markAsRead) actions.push('marcar como lido');
  if (rule.markAsImportant) actions.push('marcar importante');
  if (rule.markAsStarred) actions.push('marcar com estrela');
  if (rule.removeFromInbox) actions.push('arquivar');

  return (
    `"${rule.name}"${rule.isActive ? '' : ' (inativa)'} — ` +
    `condições: ${conditions.join('; ') || 'nenhuma'} — ` +
    `ações: ${actions.join('; ') || 'nenhuma'}`
  );
}

export async function listEmailRules(
  accountEmail: string | undefined,
  connectedAccountRepository: PrismaConnectedAccountRepository,
  emailRuleRepository: PrismaEmailRuleRepository,
  userId: string,
): Promise<string> {
  const account = await resolveAccount(
    accountEmail,
    connectedAccountRepository,
    userId,
  );
  const rules = await findAllEmailRules(account.id, emailRuleRepository);

  if (rules.length === 0) {
    return `A conta ${account.emailAddress} não tem regras de email.`;
  }

  return (
    `Regras de ${account.emailAddress}, por ordem de execução:\n` +
    rules.map((rule, index) => `${index + 1}. ${describeRule(rule)}`).join('\n')
  );
}

export async function createEmailRuleTool(
  input: { accountEmail?: string } & CreateEmailRuleDto,
  connectedAccountRepository: PrismaConnectedAccountRepository,
  emailRuleRepository: PrismaEmailRuleRepository,
  userId: string,
): Promise<string> {
  const { accountEmail, ...dto } = input;
  const account = await resolveAccount(
    accountEmail,
    connectedAccountRepository,
    userId,
  );
  const rule = await createEmailRule(account.id, dto, emailRuleRepository);

  return `Criei a regra ${describeRule(rule)} na conta ${account.emailAddress}.`;
}

/**
 * O agente identifica a regra pelo nome, que é o que o utilizador usa a falar. Se houver
 * mais que uma com o mesmo nome recusa-se a adivinhar, em vez de mexer na errada.
 */
async function resolveRuleByName(
  accountId: string,
  ruleName: string,
  emailRuleRepository: PrismaEmailRuleRepository,
) {
  const rules = await findAllEmailRules(accountId, emailRuleRepository);
  const matches = rules.filter(
    (rule) => rule.name.toLowerCase() === ruleName.toLowerCase().trim(),
  );

  if (matches.length === 0) {
    const available = rules.map((rule) => `"${rule.name}"`).join(', ');
    throw new Error(
      `Não há nenhuma regra chamada "${ruleName}". Existem: ${available || 'nenhuma'}.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Há ${matches.length} regras chamadas "${ruleName}". Renomeia-as na página de regras antes de eu poder mexer.`,
    );
  }
  return matches[0];
}

export async function updateEmailRuleTool(
  input: { accountEmail?: string; ruleName: string } & UpdateEmailRuleDto,
  connectedAccountRepository: PrismaConnectedAccountRepository,
  emailRuleRepository: PrismaEmailRuleRepository,
  userId: string,
): Promise<string> {
  const { accountEmail, ruleName, ...dto } = input;
  const account = await resolveAccount(
    accountEmail,
    connectedAccountRepository,
    userId,
  );
  const existing = await resolveRuleByName(
    account.id,
    ruleName,
    emailRuleRepository,
  );

  const updated = await updateEmailRule(
    existing.id,
    account.id,
    dto,
    emailRuleRepository,
  );

  return `Alterei a regra. Ficou: ${describeRule(updated)}.`;
}

export async function deleteEmailRuleTool(
  input: { accountEmail?: string; ruleName: string },
  connectedAccountRepository: PrismaConnectedAccountRepository,
  emailRuleRepository: PrismaEmailRuleRepository,
  userId: string,
): Promise<string> {
  const account = await resolveAccount(
    input.accountEmail,
    connectedAccountRepository,
    userId,
  );
  const existing = await resolveRuleByName(
    account.id,
    input.ruleName,
    emailRuleRepository,
  );

  await deleteEmailRule(existing.id, account.id, emailRuleRepository);

  return `Apaguei a regra "${existing.name}" da conta ${account.emailAddress}. Isto não se desfaz.`;
}
