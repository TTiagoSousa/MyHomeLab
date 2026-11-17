import { Module } from '@nestjs/common';
import { AiCredentialModule } from 'src/ai-credential/ai-credential.module';
import { NotificationModule } from 'src/notification/notification.module';
import { TodoModule } from 'src/todo/todo.module';
import { DocConflictsService } from './doc-conflicts.service';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';
import { ProjectsService } from './projects.service';
import { DocMapsService } from './maps/doc-maps.service';
import { DocSectionsService } from './doc-sections.service';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';

@Module({
  imports: [AiCredentialModule, NotificationModule, TodoModule],
  controllers: [DocsController],
  providers: [
    DocsService,
    ProjectsService,
    DocConflictsService,
    DocMapsService,
    DocSectionsService,
    PrismaConnectedAccountRepository,
  ],
  exports: [DocsService, ProjectsService],
})
export class DocsModule {}
