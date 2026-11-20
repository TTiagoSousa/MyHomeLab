import { Module } from '@nestjs/common';
import { ConnectedAccountModule } from 'src/connected-account/connected-account.module';
import { DriveService } from './drive.service';
import { GoogleDriveController } from './google-drive.controller';

@Module({
  imports: [ConnectedAccountModule],
  controllers: [GoogleDriveController],
  providers: [DriveService],
  exports: [DriveService],
})
export class GoogleDriveModule {}
