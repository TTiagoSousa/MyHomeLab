import {
  BadRequestException,
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
import { DocLinkType } from 'src/generated/prisma/client/client';
import { DocConflictsService } from './doc-conflicts.service';
import { DocsService } from './docs.service';
import { DocMapsService } from './maps/doc-maps.service';
import {
  ApproveDocProposalDto,
  CreateDocDto,
  CreateDocSectionDto,
  ListDocsQueryDto,
  UpdateDocDto,
  UpdateDocSectionDto,
} from './dto/doc.dto';
import { DocSectionsService } from './doc-sections.service';

type AuthedRequest = Request & { user: JwtPayload };

/** Os documentos de quem tem a sessão aberta (regras, checklists, notas, guias…). */
@Controller('docs')
@UseGuards(JwtAuthGuard)
export class DocsController {
  constructor(
    private readonly docs: DocsService,
    private readonly conflicts: DocConflictsService,
    private readonly maps: DocMapsService,
    private readonly sections: DocSectionsService,
  ) {}

  @Get()
  list(@Query() query: ListDocsQueryDto, @Req() req: AuthedRequest) {
    return this.docs.list(req.user.id, query);
  }

  /** Tudo a que um documento se pode ligar. */
  @Get('targets')
  targets(@Req() req: AuthedRequest) {
    return this.docs.targets(req.user.id);
  }

  /** Os documentos ligados a uma coisa: `?type=APP&targetId=…`. */
  @Get('linked')
  linked(
    @Query('type') type: string,
    @Query('targetId') targetId: string,
    @Req() req: AuthedRequest,
  ) {
    if (
      !Object.values(DocLinkType).includes(type as DocLinkType) ||
      !targetId
    ) {
      throw new BadRequestException('Falta o tipo ou o alvo da ligação.');
    }
    return this.docs.linked(req.user.id, type as DocLinkType, targetId);
  }

  @Get('proposals')
  proposals(@Req() req: AuthedRequest) {
    return this.docs.proposals(req.user.id);
  }

  @Post('proposals/:id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveDocProposalDto,
    @Req() req: AuthedRequest,
  ) {
    return this.docs.approve(req.user.id, id, dto.content);
  }

  @Post('proposals/:id/reject')
  @HttpCode(204)
  async reject(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.docs.reject(req.user.id, id);
  }

  /** Cria os documentos sugeridos que faltam (regras gerais, checklists, uma por app). */
  /** Compara já o documento com as regras que valem ao mesmo tempo. */
  @Post(':id/check-conflicts')
  checkConflicts(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.conflicts.check(req.user.id, id);
  }

  /** As secções do utilizador (a árvore dos Documentos). */
  @Get('sections')
  listSections(@Req() req: AuthedRequest) {
    return this.sections.list(req.user.id);
  }

  @Post('sections')
  createSection(@Body() dto: CreateDocSectionDto, @Req() req: AuthedRequest) {
    return this.sections.create(req.user.id, dto);
  }

  @Patch('sections/:id')
  updateSection(
    @Param('id') id: string,
    @Body() dto: UpdateDocSectionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.sections.update(req.user.id, id, dto);
  }

  /** Apaga a secção; os documentos e as subsecções dela sobem um nível. */
  @Delete('sections/:id')
  removeSection(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.sections.remove(req.user.id, id);
  }

  /** Refaz já os mapas automáticos (servidores e apps ligadas). */
  @Post('maps/refresh')
  async refreshMaps(@Req() req: AuthedRequest) {
    return { written: await this.maps.refreshUser(req.user.id) };
  }

  @Get('templates')
  templates() {
    return this.docs.templateSets();
  }

  @Post('templates/:id')
  applyTemplate(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.docs.applyTemplateSet(req.user.id, id);
  }

  @Post('starter')
  starter(@Req() req: AuthedRequest) {
    return this.docs.createStarter(req.user.id);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.docs.get(req.user.id, id);
  }

  @Post()
  create(@Body() dto: CreateDocDto, @Req() req: AuthedRequest) {
    return this.docs.create(req.user.id, dto, { kind: 'user' });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDocDto,
    @Req() req: AuthedRequest,
  ) {
    return this.docs.update(req.user.id, id, dto, { kind: 'user' });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.docs.remove(req.user.id, id);
  }

  @Get(':id/versions/:versionId')
  version(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.docs.version(req.user.id, id, versionId);
  }

  @Post(':id/versions/:versionId/restore')
  restore(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.docs.restore(req.user.id, id, versionId);
  }
}
