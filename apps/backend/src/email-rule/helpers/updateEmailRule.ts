import { PrismaEmailRuleRepository } from '../repositories/prisma/prisma-email-rule-repository';
import { UpdateEmailRuleDto } from '../dto/update-email-rule.dto';
import { findEmailRule } from './findEmailRule';

export async function updateEmailRule(
  id: string,
  accountId: string,
  dto: UpdateEmailRuleDto,
  emailRuleRepository: PrismaEmailRuleRepository,
) {
  await findEmailRule(id, accountId, emailRuleRepository);
  return emailRuleRepository.update(id, dto);
}
