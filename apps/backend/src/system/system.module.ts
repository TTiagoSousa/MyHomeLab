import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { AppReleaseController } from './app-release.controller';
import { StatusService } from './status.service';

@Module({
  controllers: [SystemController, AppReleaseController],
  providers: [SystemService, StatusService],
})
export class SystemModule {}
