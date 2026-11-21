import { PrismaEmailRuleRepository } from '../repositories/prisma/prisma-email-rule-repository';
import { CreateEmailRuleDto } from '../dto/create-email-rule.dto';
import { assertSafePatterns } from './assertSafePatterns';

function buildFallbackName(dto: CreateEmailRuleDto): string {
  if (dto.name && dto.name.trim() !== '') return dto.name.trim();

  const path = (dto.labelPaths ?? []).map((entry) => entry.path).join('  •  ');
  if (path) return path;

  if (dto.fromContains?.length) return `De: ${dto.fromContains.join(', ')}`;
  if (dto.subjectContains?.length)
    return `Assunto: ${dto.subjectContains.join(', ')}`;
  if (dto.mailKind === 'BULK') return 'Publicidade e newsletters';

  return 'Nova regra';
}

export async function createEmailRule(
  accountId: string,
  dto: CreateEmailRuleDto,
  emailRuleRepository: PrismaEmailRuleRepository,
) {
  assertSafePatterns(dto);
  const order = await emailRuleRepository.countByAccount(accountId);
  return emailRuleRepository.create({
    ...dto,
    name: buildFallbackName(dto),
    accountId,
    order,
  });
}
