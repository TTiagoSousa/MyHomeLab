import { Module } from '@nestjs/common';
import { ServerConnectionController } from './server-connection.controller';
import { ServerConnectionService } from './server-connection.service';
import { ServerConnectionScheduler } from './server-connection.scheduler';
import { ServerCommandService } from './server-command.service';
import { NotificationModule } from 'src/notification/notification.module';
import { DocsModule } from 'src/docs/docs.module';
import { PrismaServerHostKeyRepository } from './repositories/prisma/prisma-server-host-key-repository';

@Module({
  imports: [NotificationModule, DocsModule],
  controllers: [ServerConnectionController],
  providers: [
    ServerConnectionService,
    ServerConnectionScheduler,
    ServerCommandService,
    PrismaServerHostKeyRepository,
  ],
  exports: [ServerConnectionService, ServerCommandService],
})
export class ServerConnectionModule {}
