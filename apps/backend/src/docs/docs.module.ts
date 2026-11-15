import { Module } from '@nestjs/common';
import { AiCredentialModule } from 'src/ai-credential/ai-credential.module';
import { NotificationModule } from 'src/notification/notification.module';
import { TodoModule } from 'src/todo/todo.module';
import { DocConflictsService } from './doc-conflicts.service';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AiCredentialModule, NotificationModule, TodoModule],
  controllers: [DocsController],
  providers: [DocsService, ProjectsService, DocConflictsService],
  exports: [DocsService, ProjectsService],
})
export class DocsModule {}
