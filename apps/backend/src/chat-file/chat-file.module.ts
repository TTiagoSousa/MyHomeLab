import { Module } from '@nestjs/common';
import { ChatFileService } from './chat-file.service';

@Module({
  providers: [ChatFileService],
  exports: [ChatFileService],
})
export class ChatFileModule {}
