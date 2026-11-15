import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConnectedAccountService } from './connected-account.service';
import { ConnectedAccountController } from './connected-account.controller';
import { ConnectedAccountScheduler } from './connected-account.scheduler';
import { NotificationModule } from 'src/notification/notification.module';
import { AppUpdateModule } from 'src/app-update/app-update.module';
import { PrismaConnectedAccountRepository } from './repositories/prisma/prisma-connected-account-repository';

@Module({
  imports: [
    NotificationModule,
    AppUpdateModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [ConnectedAccountController],
  providers: [
    ConnectedAccountService,
    ConnectedAccountScheduler,
    {
      provide: PrismaConnectedAccountRepository,
      useClass: PrismaConnectedAccountRepository,
    },
  ],
  exports: [PrismaConnectedAccountRepository],
})
export class ConnectedAccountModule {}
