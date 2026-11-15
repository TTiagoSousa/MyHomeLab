import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Put,
  Req,
  Sse,
  UseGuards,
  MessageEvent,
} from '@nestjs/common';
import { Observable, map, merge, defer, of } from 'rxjs';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { AgentService } from './agent.service';
import { AgentActivityService } from 'src/agent-activity/agent-activity.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { UpdateAssistantPermissionsDto } from './dto/update-assistant-permissions.dto';
import { AgentAccessService } from './agent-access.service';
import {
  AgentAccessQueryDto,
  SaveAgentAccessDto,
} from './dto/agent-access.dto';

@Controller('agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly activity: AgentActivityService,
    private readonly access: AgentAccessService,
  ) {}

  @Get()
  findAll(@Req() req: Request & { user: JwtPayload }) {
    return this.agentService.findAll(req.user.id);
  }

  /** As ferramentas que se podem dar a um agente (página Workflow). */
  @Get('tools')
  findTools() {
    return this.agentService.findTools();
  }

  @Post()
  create(
    @Body() dto: CreateAgentDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.agentService.create(dto, req.user.id);
  }

  /** O registo dos agentes (pedidos, ações, fim), página a página para trás. */
  @Get('logs')
  findLogs(
    @Query() query: { agent?: string; before?: string; limit?: string },
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.agentService.findLogs(req.user.id, query);
  }

  /** As linhas novas do registo, ao vivo (SSE), para a consola da página Workflow. */
  @Sse('logs/stream')
  logStream(
    @Req() req: Request & { user: JwtPayload },
  ): Observable<MessageEvent> {
    return this.activity.logStream(req.user.id).pipe(map((data) => ({ data })));
  }

  /** O que cada agente pode fazer numa app ou servidor (a página da app → Agentes). */
  @Get('access')
  findAccess(
    @Query() query: AgentAccessQueryDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.access.list(req.user.id, query.type, query.targetId);
  }

  @Put('access')
  saveAccess(
    @Body() dto: SaveAgentAccessDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.access.set(
      req.user.id,
      dto.type,
      dto.targetId,
      dto.agentKey,
      dto.level,
    );
  }

  /** O que o Jarvis pode ler e alterar (Assistente → Definições → Permissões). */
  @Get('permissions')
  findPermissions(@Req() req: Request & { user: JwtPayload }) {
    return this.agentService.findPermissions(req.user.id);
  }

  @Put('permissions')
  updatePermissions(
    @Body() dto: UpdateAssistantPermissionsDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.agentService.updatePermissions(req.user.id, dto);
  }

  /**
   * O estado ao vivo, por Server-Sent Events. SSE e não WebSocket porque isto só corre
   * num sentido — servidor para página — e assim aproveita o cookie de sessão e o CORS
   * que já existem, sem dependências novas.
   *
   * O primeiro evento é o estado atual: quem abre a página a meio de um trabalho tem de
   * o ver, e não ficar em branco à espera da próxima mudança.
   */
  @Sse('stream')
  stream(@Req() req: Request & { user: JwtPayload }): Observable<MessageEvent> {
    const userId = req.user.id;
    return merge(
      defer(() => of(this.activity.snapshot(userId))),
      this.activity.stream(userId),
    ).pipe(map((data) => ({ data })));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAgentDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.agentService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request & { user: JwtPayload }) {
    return this.agentService.remove(id, req.user.id);
  }
}
