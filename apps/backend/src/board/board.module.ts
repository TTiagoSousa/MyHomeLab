import { Module } from '@nestjs/common';
import { TodoModule } from 'src/todo/todo.module';
import { BoardController } from './board.controller';
import { BoardService } from './board.service';
import { BoardWorkService } from './board-work.service';

@Module({
  imports: [TodoModule],
  controllers: [BoardController],
  providers: [BoardService, BoardWorkService],
  exports: [BoardService, BoardWorkService],
})
export class BoardModule {}
