import { PrismaEmailRuleRepository } from '../repositories/prisma/prisma-email-rule-repository';
import { UpdateEmailRuleDto } from '../dto/update-email-rule.dto';
import { findEmailRule } from './findEmailRule';
import { assertSafePatterns } from './assertSafePatterns';

export async function updateEmailRule(
  id: string,
  accountId: string,
  dto: UpdateEmailRuleDto,
  emailRuleRepository: PrismaEmailRuleRepository,
) {
  const current = await findEmailRule(id, accountId, emailRuleRepository);
  assertSafePatterns({
    matchType: dto.matchType ?? current.matchType,
    fromContains: dto.fromContains ?? current.fromContains,
    subjectContains: dto.subjectContains ?? current.subjectContains,
  });
  return emailRuleRepository.update(id, dto);
}
