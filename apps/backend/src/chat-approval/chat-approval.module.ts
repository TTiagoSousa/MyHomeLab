import { Module } from '@nestjs/common';
import { AgentModule } from 'src/agent/agent.module';
import { AppUpdateModule } from 'src/app-update/app-update.module';
import { ConnectedAccountModule } from 'src/connected-account/connected-account.module';
import { ChatApprovalController } from './chat-approval.controller';
import { ChatApprovalService } from './chat-approval.service';

@Module({
  imports: [AgentModule, AppUpdateModule, ConnectedAccountModule],
  controllers: [ChatApprovalController],
  providers: [ChatApprovalService],
  exports: [ChatApprovalService],
})
export class ChatApprovalModule {}
