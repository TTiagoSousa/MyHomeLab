import { Injectable } from '@nestjs/common';
import { PrismaEmailRuleRepository } from './repositories/prisma/prisma-email-rule-repository';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { AgentActivityService } from 'src/agent-activity/agent-activity.service';
import { findConnectedAccount } from 'src/connected-account/helpers/findConnectedAccount';
import { createEmailRule } from './helpers/createEmailRule';
import { findAllEmailRules } from './helpers/findAllEmailRules';
import { findEmailRule } from './helpers/findEmailRule';
import { updateEmailRule } from './helpers/updateEmailRule';
import { deleteEmailRule } from './helpers/deleteEmailRule';
import { reorderEmailRules } from './helpers/reorderEmailRules';
import { runEmailRules } from './helpers/runEmailRules';
import { CreateEmailRuleDto } from './dto/create-email-rule.dto';
import { UpdateEmailRuleDto } from './dto/update-email-rule.dto';
import { ReorderEmailRuleDto } from './dto/reorder-email-rule.dto';
import { RunEmailRuleDto } from './dto/run-email-rule.dto';

@Injectable()
export class EmailRuleService {
  constructor(
    private readonly emailRuleRepository: PrismaEmailRuleRepository,
    private readonly connectedAccountRepository: PrismaConnectedAccountRepository,
    private readonly activity: AgentActivityService,
  ) {}

  private async assertAccountOwnership(accountId: string, userId: string) {
    return findConnectedAccount(
      accountId,
      userId,
      this.connectedAccountRepository,
    );
  }

  async create(accountId: string, dto: CreateEmailRuleDto, userId: string) {
    await this.assertAccountOwnership(accountId, userId);
    return createEmailRule(accountId, dto, this.emailRuleRepository);
  }

  async findAll(accountId: string, userId: string) {
    await this.assertAccountOwnership(accountId, userId);
    return findAllEmailRules(accountId, this.emailRuleRepository);
  }

  async findOne(accountId: string, id: string, userId: string) {
    await this.assertAccountOwnership(accountId, userId);
    return findEmailRule(id, accountId, this.emailRuleRepository);
  }

  async update(
    accountId: string,
    id: string,
    dto: UpdateEmailRuleDto,
    userId: string,
  ) {
    await this.assertAccountOwnership(accountId, userId);
    return updateEmailRule(id, accountId, dto, this.emailRuleRepository);
  }

  async remove(accountId: string, id: string, userId: string) {
    await this.assertAccountOwnership(accountId, userId);
    return deleteEmailRule(id, accountId, this.emailRuleRepository);
  }

  async reorder(accountId: string, dto: ReorderEmailRuleDto, userId: string) {
    await this.assertAccountOwnership(accountId, userId);
    return reorderEmailRules(accountId, dto, this.emailRuleRepository);
  }

  async run(accountId: string, dto: RunEmailRuleDto, userId: string) {
    const account = await this.assertAccountOwnership(accountId, userId);
    // O "Executar agora" acende quem trata do email na equipa, tal como o cron — quem está
    // na página Workflow vê o trabalho, venha ele de um botão ou do agendador.
    return this.activity.trackOwner(
      userId,
      'list_email_rules',
      `a correr as regras de ${account.emailAddress ?? 'uma conta'}`,
      () =>
        runEmailRules(
          accountId,
          dto.scope,
          this.emailRuleRepository,
          this.connectedAccountRepository,
        ),
    );
  }
}
