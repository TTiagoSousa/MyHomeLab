import { NotFoundException } from '@nestjs/common';
import { EmailRuleRepository } from '../repositories/email-rule-repository';

export async function findEmailRule(
  id: string,
  accountId: string,
  repository: EmailRuleRepository,
) {
  const rule = await repository.findById(id);
  if (!rule || rule.accountId !== accountId)
    throw new NotFoundException('Regra não encontrada');
  return rule;
}
