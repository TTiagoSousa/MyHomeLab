import { Module } from '@nestjs/common';
import { NotificationModule } from 'src/notification/notification.module';
import { AiCredentialController } from './ai-credential.controller';
import { AiCredentialService } from './ai-credential.service';
import { AiUsageController } from './ai-usage.controller';
import { AiUsageService } from './ai-usage.service';

@Module({
  imports: [NotificationModule],
  controllers: [AiCredentialController, AiUsageController],
  providers: [AiCredentialService, AiUsageService],
  exports: [AiCredentialService, AiUsageService],
})
export class AiCredentialModule {}
