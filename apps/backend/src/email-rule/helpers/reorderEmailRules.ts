import { BadRequestException } from '@nestjs/common';
import { PrismaEmailRuleRepository } from '../repositories/prisma/prisma-email-rule-repository';
import { ReorderEmailRuleDto } from '../dto/reorder-email-rule.dto';

export async function reorderEmailRules(
  accountId: string,
  dto: ReorderEmailRuleDto,
  emailRuleRepository: PrismaEmailRuleRepository,
) {
  const rules = await emailRuleRepository.findAllByAccount(accountId);

  const ownedIds = new Set(rules.map((rule) => rule.id));
  const sameSize = dto.orderedIds.length === rules.length;
  const allOwned = dto.orderedIds.every((id) => ownedIds.has(id));

  if (!sameSize || !allOwned) {
    throw new BadRequestException('Lista de regras inválida');
  }

  await emailRuleRepository.reorder(accountId, dto.orderedIds);

  return emailRuleRepository.findAllByAccount(accountId);
}
