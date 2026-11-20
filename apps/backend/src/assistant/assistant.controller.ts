import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import {
  MAX_CHAT_FILES,
  MAX_CHAT_FILE_BYTES,
} from 'src/chat-file/chat-file.service';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AssistantService } from './assistant.service';
import {
  AskAssistantDto,
  RenameConversationDto,
} from './dto/ask-assistant.dto';
import { PreviewStyleDto } from './dto/preview-style.dto';

@Controller('assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get('history')
  async history(
    @Req() req: Request & { user: JwtPayload },
    @Query('limit') limit?: string,
  ) {
    const parsed = Number(limit);
    const take =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 200) : 10;
    return this.assistantService.history(req.user.id, take);
  }

  @Get('conversations')
  conversations(@Req() req: Request & { user: JwtPayload }) {
    return this.assistantService.conversations(req.user.id);
  }

  /** A conversa de uma tarefa do quadro (cria-a na primeira vez). */
  @Post('conversations/task/:taskId')
  taskConversation(
    @Param('taskId') taskId: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.assistantService.taskConversation(req.user.id, taskId);
  }

  @Get('conversations/:id/messages')
  conversationMessages(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.assistantService.conversationMessages(req.user.id, id);
  }

  @Patch('conversations/:id')
  renameConversation(
    @Param('id') id: string,
    @Body() dto: RenameConversationDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.assistantService.renameConversation(req.user.id, id, dto.title);
  }

  @Delete('conversations/:id')
  @HttpCode(204)
  async deleteConversation(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    await this.assistantService.deleteConversation(req.user.id, id);
  }

  /** A mensagem, em JSON ou (com ficheiros) em multipart: o campo "files", até 5. */
  @Post('chat')
  @HttpCode(200)
  @UseInterceptors(
    FilesInterceptor('files', MAX_CHAT_FILES, {
      limits: { fileSize: MAX_CHAT_FILE_BYTES },
    }),
  )
  async chat(
    @Body() dto: AskAssistantDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.assistantService.ask(
      req.user,
      dto.message ?? '',
      {
        conversationId: dto.conversationId,
        newConversation: dto.newConversation,
      },
      files ?? [],
    );
  }

  /** Um ficheiro que ele mandou no chat, para abrir ou descarregar. */
  @Get('files/:id')
  @Header('X-Content-Type-Options', 'nosniff')
  async file(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ) {
    const file = await this.assistantService.chatFile(req.user.id, id);
    // Só imagens e PDF abrem no browser; o resto descarrega-se, para um ficheiro não
    // correr código na origem da API.
    const inline = /^(image\/(png|jpe?g|gif|webp)|application\/pdf)$/.test(
      file.mimeType,
    );
    return new StreamableFile(Buffer.from(file.data), {
      type: inline ? file.mimeType : 'application/octet-stream',
      disposition: `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    });
  }

  /** Como ficaria a última resposta com estas instruções do Jarvis (sem as gravar). */
  @Post('preview-style')
  @HttpCode(200)
  async previewStyle(
    @Body() dto: PreviewStyleDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.assistantService.previewStyle(req.user, dto.customPrompt);
  }

  @Delete('history')
  @HttpCode(204)
  async clear(@Req() req: Request & { user: JwtPayload }) {
    await this.assistantService.clear(req.user.id);
  }
}
