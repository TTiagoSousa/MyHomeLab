import {
  Body,
  Header,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { BoardService, TaskInput } from './board.service';
import { BoardWorkService } from './board-work.service';
import {
  BulkTasksDto,
  CommentDto,
  RelationDto,
  SaveCycleDto,
  LinkDocDto,
  LinkDto,
  ListTasksQueryDto,
  SaveModuleDto,
  SaveProjectDto,
  SaveStateDto,
  SaveTaskDto,
} from './dto/board.dto';

type AuthedRequest = Request & { user: JwtPayload };

const toDate = (value: string | null | undefined) =>
  value === undefined ? undefined : value ? new Date(value) : null;

const toTask = (dto: SaveTaskDto): TaskInput => ({
  ...dto,
  startDate: toDate(dto.startDate),
  dueDate: toDate(dto.dueDate),
});

/** O quadro de tarefas (Projetos) de quem tem a sessão aberta. */
@Controller('board')
@UseGuards(JwtAuthGuard)
export class BoardController {
  constructor(
    private readonly board: BoardService,
    private readonly work: BoardWorkService,
  ) {}

  /** O que precisa dele: perguntas, disparos que falharam, prazos e tentativas a meio. */
  @Get('attention')
  attention(@Req() req: AuthedRequest) {
    return this.work.attention(req.user.id);
  }

  // ── Projetos, colunas e módulos ──

  @Get('projects')
  projects(@Req() req: AuthedRequest) {
    return this.board.projects(req.user.id);
  }

  @Post('projects')
  createProject(@Body() dto: SaveProjectDto, @Req() req: AuthedRequest) {
    return this.board.createProject(req.user.id, dto);
  }

  @Patch('projects/:id')
  updateProject(
    @Param('id') id: string,
    @Body() dto: SaveProjectDto,
    @Req() req: AuthedRequest,
  ) {
    return this.board.updateProject(req.user.id, id, dto);
  }

  @Delete('projects/:id')
  @HttpCode(204)
  async removeProject(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.board.removeProject(req.user.id, id);
  }

  @Post('projects/:id/states')
  createState(
    @Param('id') id: string,
    @Body() dto: SaveStateDto,
    @Req() req: AuthedRequest,
  ) {
    return this.board.createState(req.user.id, id, {
      ...dto,
      name: dto.name ?? '',
    });
  }

  @Patch('states/:id')
  updateState(
    @Param('id') id: string,
    @Body() dto: SaveStateDto,
    @Req() req: AuthedRequest,
  ) {
    return this.board.updateState(req.user.id, id, dto);
  }

  @Delete('states/:id')
  @HttpCode(204)
  async removeState(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.board.removeState(req.user.id, id);
  }

  @Post('projects/:id/modules')
  createModule(
    @Param('id') id: string,
    @Body() dto: SaveModuleDto,
    @Req() req: AuthedRequest,
  ) {
    return this.board.createModule(req.user.id, id, {
      ...dto,
      name: dto.name ?? '',
    });
  }

  @Patch('modules/:id')
  updateModule(
    @Param('id') id: string,
    @Body() dto: SaveModuleDto,
    @Req() req: AuthedRequest,
  ) {
    return this.board.updateModule(req.user.id, id, dto);
  }

  @Delete('modules/:id')
  @HttpCode(204)
  async removeModule(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.board.removeModule(req.user.id, id);
  }

  // ── Tarefas ──

  @Get('tasks')
  tasks(@Query() query: ListTasksQueryDto, @Req() req: AuthedRequest) {
    return this.board.tasks(req.user.id, {
      ...query,
      open: query.open === 'true',
    });
  }

  /** Mudar várias tarefas de uma vez (coluna, prioridade, responsável…). */
  @Patch('tasks/bulk')
  bulk(@Body() dto: BulkTasksDto, @Req() req: AuthedRequest) {
    const { ids, ...input } = dto;
    return this.work.bulkUpdate(req.user.id, ids, toTask(input), 'user');
  }

  @Get('tasks/:id')
  task(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.board.task(req.user.id, id);
  }

  @Post('tasks')
  createTask(@Body() dto: SaveTaskDto, @Req() req: AuthedRequest) {
    return this.board.createTask(req.user.id, toTask(dto), 'user');
  }

  @Patch('tasks/:id')
  updateTask(
    @Param('id') id: string,
    @Body() dto: SaveTaskDto,
    @Req() req: AuthedRequest,
  ) {
    return this.board.updateTask(req.user.id, id, toTask(dto), 'user');
  }

  @Delete('tasks/:id')
  @HttpCode(204)
  async removeTask(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.board.removeTask(req.user.id, id);
  }

  /** Um comentário dele põe o agente da tarefa a trabalhar (nos Disparos). */
  @Post('tasks/:id/comments')
  comment(
    @Param('id') id: string,
    @Body() dto: CommentDto,
    @Req() req: AuthedRequest,
  ) {
    return this.board.comment(req.user.id, id, dto.body, 'user');
  }

  @Post('tasks/:id/links')
  addLink(
    @Param('id') id: string,
    @Body() dto: LinkDto,
    @Req() req: AuthedRequest,
  ) {
    return this.board.addLink(req.user.id, id, dto, 'user');
  }

  @Delete('tasks/:id/links/:linkId')
  @HttpCode(204)
  async removeLink(
    @Param('id') id: string,
    @Param('linkId') linkId: string,
    @Req() req: AuthedRequest,
  ) {
    await this.board.removeLink(req.user.id, id, linkId);
  }

  @Post('tasks/:id/docs')
  @HttpCode(204)
  async linkDoc(
    @Param('id') id: string,
    @Body() dto: LinkDocDto,
    @Req() req: AuthedRequest,
  ) {
    await this.board.linkDoc(req.user.id, id, dto.docId, 'user');
  }

  @Delete('tasks/:id/docs/:docId')
  @HttpCode(204)
  async unlinkDoc(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Req() req: AuthedRequest,
  ) {
    await this.board.unlinkDoc(req.user.id, id, docId);
  }

  // ── Ciclos, relações e anexos ──

  @Post('projects/:id/cycles')
  createCycle(
    @Param('id') id: string,
    @Body() dto: SaveCycleDto,
    @Req() req: AuthedRequest,
  ) {
    return this.work.createCycle(req.user.id, id, {
      name: dto.name ?? '',
      startDate: new Date(dto.startDate ?? Date.now()),
      endDate: new Date(dto.endDate ?? Date.now()),
    });
  }

  @Patch('cycles/:id')
  updateCycle(
    @Param('id') id: string,
    @Body() dto: SaveCycleDto,
    @Req() req: AuthedRequest,
  ) {
    return this.work.updateCycle(req.user.id, id, {
      name: dto.name,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });
  }

  @Delete('cycles/:id')
  @HttpCode(204)
  async removeCycle(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.work.removeCycle(req.user.id, id);
  }

  @Post('tasks/:id/relations')
  relate(
    @Param('id') id: string,
    @Body() dto: RelationDto,
    @Req() req: AuthedRequest,
  ) {
    return this.work.relate(req.user.id, id, dto.task, dto.kind, 'user');
  }

  @Delete('relations/:id')
  @HttpCode(204)
  async unrelate(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.work.unrelate(req.user.id, id);
  }

  @Post('tasks/:id/attachments')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  attach(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    return this.work.attach(req.user.id, id, file, 'user');
  }

  @Get('attachments/:id')
  @Header('X-Content-Type-Options', 'nosniff')
  async attachment(@Param('id') id: string, @Req() req: AuthedRequest) {
    const file = await this.work.attachment(req.user.id, id);
    // Só imagens, PDF e texto simples abrem no browser; o resto (HTML, SVG…) descarrega-se,
    // para um anexo não correr código na origem da API.
    const inline =
      /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/plain)$/.test(
        file.mimeType,
      );
    return new StreamableFile(Buffer.from(file.data), {
      type: inline ? file.mimeType : 'application/octet-stream',
      disposition: `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    });
  }

  @Delete('attachments/:id')
  @HttpCode(204)
  async removeAttachment(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.work.removeAttachment(req.user.id, id);
  }
}
