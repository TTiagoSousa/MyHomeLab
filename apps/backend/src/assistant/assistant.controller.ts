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

  @Post('chat')
  @HttpCode(200)
  async chat(
    @Body() dto: AskAssistantDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.assistantService.ask(req.user, dto.message, {
      conversationId: dto.conversationId,
      newConversation: dto.newConversation,
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
