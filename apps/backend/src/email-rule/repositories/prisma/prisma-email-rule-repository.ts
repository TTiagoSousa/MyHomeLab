import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  EmailRuleFields,
  EmailRuleRepository,
  EmailRuleWithLabelPaths,
} from '../email-rule-repository';
import { scheduleEmailRulesDoc } from '../../helpers/emailRulesDoc';

const labelPathsOrderBy = {
  labelPaths: { orderBy: { order: 'asc' as const } },
};

@Injectable()
export class PrismaEmailRuleRepository implements EmailRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<EmailRuleWithLabelPaths | null> {
    return this.prisma.emailRule.findUnique({
      where: { id },
      include: labelPathsOrderBy,
    });
  }

  async findAllByAccount(
    accountId: string,
  ): Promise<EmailRuleWithLabelPaths[]> {
    return this.prisma.emailRule.findMany({
      where: { accountId },
      orderBy: { order: 'asc' },
      include: labelPathsOrderBy,
    });
  }

  async countByAccount(accountId: string): Promise<number> {
    return this.prisma.emailRule.count({ where: { accountId } });
  }

  async create(
    data: Partial<EmailRuleFields> & {
      name: string;
      accountId: string;
      order: number;
    },
  ): Promise<EmailRuleWithLabelPaths> {
    const { labelPaths, ...fields } = data;
    scheduleEmailRulesDoc(this.prisma, data.accountId);
    return this.prisma.emailRule.create({
      data: {
        ...fields,
        labelPaths: labelPaths
          ? {
              create: labelPaths.map((entry, index) => ({
                path: entry.path,
                labelMode: entry.labelMode,
                order: index,
              })),
            }
          : undefined,
      },
      include: labelPathsOrderBy,
    });
  }

  async update(
    id: string,
    data: Partial<EmailRuleFields>,
  ): Promise<EmailRuleWithLabelPaths> {
    const { labelPaths, ...fields } = data;
    const updated = await this.prisma.emailRule.update({
      where: { id },
      data: {
        ...fields,
        ...(labelPaths !== undefined
          ? {
              labelPaths: {
                deleteMany: {},
                create: labelPaths.map((entry, index) => ({
                  path: entry.path,
                  labelMode: entry.labelMode,
                  order: index,
                })),
              },
            }
          : {}),
      },
      include: labelPathsOrderBy,
    });
    // O documento das regras do Gmail acompanha cada mudança.
    scheduleEmailRulesDoc(this.prisma, updated.accountId);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.prisma.emailRule.delete({ where: { id } });
    scheduleEmailRulesDoc(this.prisma, deleted.accountId);
  }

  async decrementOrderAfter(accountId: string, order: number): Promise<void> {
    await this.prisma.emailRule.updateMany({
      where: { accountId, order: { gt: order } },
      data: { order: { decrement: 1 } },
    });
  }

  async reorder(accountId: string, orderedIds: string[]): Promise<void> {
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.emailRule.updateMany({
          where: { id, accountId },
          data: { order: index },
        }),
      ),
    );
    scheduleEmailRulesDoc(this.prisma, accountId);
  }
}
