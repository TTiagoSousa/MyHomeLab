import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import {
  CreateTodoDto,
  CreateTodoListDto,
  ListTodosQueryDto,
  UpdateTodoDto,
  UpdateTodoListDto,
} from './dto/todo.dto';
import { TodoService } from './todo.service';

type AuthedRequest = Request & { user: JwtPayload };

/** As tarefas (afazeres) de quem tem a sessão aberta. */
@Controller('todos')
@UseGuards(JwtAuthGuard)
export class TodoController {
  constructor(private readonly todos: TodoService) {}

  /** As listas, com quantas tarefas por fazer tem cada uma. */
  @Get('lists')
  lists(@Req() req: AuthedRequest) {
    return this.todos.lists(req.user.id);
  }

  @Post('lists')
  createList(@Body() dto: CreateTodoListDto, @Req() req: AuthedRequest) {
    return this.todos.createList(req.user.id, dto);
  }

  @Patch('lists/:id')
  updateList(
    @Param('id') id: string,
    @Body() dto: UpdateTodoListDto,
    @Req() req: AuthedRequest,
  ) {
    return this.todos.updateList(req.user.id, id, dto);
  }

  /** Apaga a lista e as tarefas dela. */
  @Delete('lists/:id')
  @HttpCode(204)
  deleteList(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.todos.deleteList(req.user.id, id);
  }

  @Get()
  list(@Query() query: ListTodosQueryDto, @Req() req: AuthedRequest) {
    return this.todos.list(req.user.id, query);
  }

  @Post()
  create(@Body() dto: CreateTodoDto, @Req() req: AuthedRequest) {
    return this.todos.create(req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTodoDto,
    @Req() req: AuthedRequest,
  ) {
    return this.todos.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.todos.remove(req.user.id, id);
  }
}
