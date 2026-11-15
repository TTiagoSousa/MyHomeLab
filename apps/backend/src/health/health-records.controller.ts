import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
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
import { LabsService } from './labs.service';
import { HealthRecordsService } from './health-records.service';
import { SaveLabReportDto } from './dto/save-lab-report.dto';
import {
  SaveDiaryEntryDto,
  SaveHealthConditionDto,
  SaveHealthProfileDto,
  SaveMedicationDto,
} from './dto/save-health-records.dto';

type AuthedRequest = Request & { user: JwtPayload };

/** Um relatório de análises em PDF tem umas centenas de KB; 15 MB chega com folga. */
const MAX_PDF_SIZE = 15 * 1024 * 1024;

/**
 * O que se regista à mão (ou a partir de um PDF) na página Saúde: análises,
 * perfil, medicação e diário. As métricas do relógio estão no HealthController.
 */
@Controller('health')
@UseGuards(JwtAuthGuard)
export class HealthRecordsController {
  constructor(
    private readonly labs: LabsService,
    private readonly records: HealthRecordsService,
  ) {}

  @Post('labs/extract')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PDF_SIZE } }),
  )
  extractLabs(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    return this.labs.extract(req.user.id, file);
  }

  @Get('labs')
  labReports(@Req() req: AuthedRequest) {
    return this.labs.reports(req.user.id);
  }

  @Get('labs/parameters')
  labParameters(@Req() req: AuthedRequest) {
    return this.labs.parameters(req.user.id);
  }

  @Get('labs/parameters/:key')
  labParameter(@Param('key') key: string, @Req() req: AuthedRequest) {
    return this.labs.parameter(req.user.id, key);
  }

  @Get('labs/analytes')
  labAnalytes() {
    return this.labs.analytes();
  }

  @Post('labs')
  createLabReport(@Body() dto: SaveLabReportDto, @Req() req: AuthedRequest) {
    return this.labs.create(req.user.id, dto);
  }

  @Get('labs/:id')
  labReport(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.labs.report(req.user.id, id);
  }

  @Put('labs/:id')
  updateLabReport(
    @Param('id') id: string,
    @Body() dto: SaveLabReportDto,
    @Req() req: AuthedRequest,
  ) {
    return this.labs.update(req.user.id, id, dto);
  }

  @Delete('labs/:id')
  removeLabReport(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.labs.remove(req.user.id, id);
  }

  @Post('labs/:id/pdf')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PDF_SIZE } }),
  )
  attachLabPdf(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    return this.labs.attachPdf(req.user.id, id, file);
  }

  @Get('labs/:id/pdf')
  async labPdf(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { buffer, fileName } = await this.labs.pdf(req.user.id, id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${encodeURIComponent(fileName)}"`,
    });
  }

  @Get('profile')
  profile(@Req() req: AuthedRequest) {
    return this.records.profile(req.user.id);
  }

  @Put('profile')
  saveProfile(@Body() dto: SaveHealthProfileDto, @Req() req: AuthedRequest) {
    return this.records.saveProfile(req.user.id, dto);
  }

  @Get('conditions')
  conditions(@Req() req: AuthedRequest) {
    return this.records.conditions(req.user.id);
  }

  @Post('conditions')
  createCondition(
    @Body() dto: SaveHealthConditionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.records.createCondition(req.user.id, dto);
  }

  @Put('conditions/:id')
  updateCondition(
    @Param('id') id: string,
    @Body() dto: SaveHealthConditionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.records.updateCondition(req.user.id, id, dto);
  }

  @Delete('conditions/:id')
  removeCondition(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.records.removeCondition(req.user.id, id);
  }

  @Get('medications')
  medications(@Req() req: AuthedRequest) {
    return this.records.medications(req.user.id);
  }

  @Post('medications')
  createMedication(@Body() dto: SaveMedicationDto, @Req() req: AuthedRequest) {
    return this.records.createMedication(req.user.id, dto);
  }

  @Put('medications/:id')
  updateMedication(
    @Param('id') id: string,
    @Body() dto: SaveMedicationDto,
    @Req() req: AuthedRequest,
  ) {
    return this.records.updateMedication(req.user.id, id, dto);
  }

  @Delete('medications/:id')
  removeMedication(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.records.removeMedication(req.user.id, id);
  }

  @Get('diary')
  diary(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Req() req: AuthedRequest,
  ) {
    return this.records.diary(req.user.id, days);
  }

  @Post('diary')
  createDiaryEntry(@Body() dto: SaveDiaryEntryDto, @Req() req: AuthedRequest) {
    return this.records.createDiaryEntry(req.user.id, dto);
  }

  @Put('diary/:id')
  updateDiaryEntry(
    @Param('id') id: string,
    @Body() dto: SaveDiaryEntryDto,
    @Req() req: AuthedRequest,
  ) {
    return this.records.updateDiaryEntry(req.user.id, id, dto);
  }

  @Delete('diary/:id')
  removeDiaryEntry(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.records.removeDiaryEntry(req.user.id, id);
  }
}
