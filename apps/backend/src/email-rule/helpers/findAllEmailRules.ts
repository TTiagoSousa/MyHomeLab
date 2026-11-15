import { PrismaEmailRuleRepository } from '../repositories/prisma/prisma-email-rule-repository';

export async function findAllEmailRules(
  accountId: string,
  emailRuleRepository: PrismaEmailRuleRepository,
) {
  return emailRuleRepository.findAllByAccount(accountId);
}
