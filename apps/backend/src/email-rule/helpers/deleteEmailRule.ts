import { PrismaEmailRuleRepository } from '../repositories/prisma/prisma-email-rule-repository';
import { findEmailRule } from './findEmailRule';

export async function deleteEmailRule(
  id: string,
  accountId: string,
  emailRuleRepository: PrismaEmailRuleRepository,
) {
  const rule = await findEmailRule(id, accountId, emailRuleRepository);
  await emailRuleRepository.delete(id);
  await emailRuleRepository.decrementOrderAfter(accountId, rule.order);
}
