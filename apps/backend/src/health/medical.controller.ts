import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
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
import { MedicalService } from './medical.service';
import {
  SaveAppointmentDto,
  SaveContactLensDto,
  SaveExamDto,
  SaveIllnessDto,
  SaveVaccineDto,
  SaveVisionDto,
} from './dto/save-health-logs.dto';

type AuthedRequest = Request & { user: JwtPayload };

/** Um relatório de exame em PDF tem umas centenas de KB; 15 MB chega com folga. */
const MAX_PDF_SIZE = 15 * 1024 * 1024;

/**
 * O histórico médico: consultas, vacinas, exames, doenças, graduações e lentes.
 * O GET devolve tudo de uma vez (são poucos registos) e o que vem aí.
 */
@Controller('health/medical')
@UseGuards(JwtAuthGuard)
export class MedicalController {
  constructor(private readonly medical: MedicalService) {}

  @Get()
  overview(@Req() req: AuthedRequest) {
    return this.medical.medical(req.user.id);
  }

  @Post('appointments')
  createAppointment(
    @Body() dto: SaveAppointmentDto,
    @Req() req: AuthedRequest,
  ) {
    return this.medical.createAppointment(req.user.id, dto);
  }

  @Put('appointments/:id')
  updateAppointment(
    @Param('id') id: string,
    @Body() dto: SaveAppointmentDto,
    @Req() req: AuthedRequest,
  ) {
    return this.medical.updateAppointment(req.user.id, id, dto);
  }

  @Delete('appointments/:id')
  removeAppointment(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.medical.remove('appointment', req.user.id, id);
  }

  @Post('vaccines')
  createVaccine(@Body() dto: SaveVaccineDto, @Req() req: AuthedRequest) {
    return this.medical.createVaccine(req.user.id, dto);
  }

  @Put('vaccines/:id')
  updateVaccine(
    @Param('id') id: string,
    @Body() dto: SaveVaccineDto,
    @Req() req: AuthedRequest,
  ) {
    return this.medical.updateVaccine(req.user.id, id, dto);
  }

  @Delete('vaccines/:id')
  removeVaccine(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.medical.remove('vaccine', req.user.id, id);
  }

  @Post('exams/extract')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PDF_SIZE } }),
  )
  extractExam(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    return this.medical.extractExam(req.user.id, file);
  }

  @Post('exams')
  createExam(@Body() dto: SaveExamDto, @Req() req: AuthedRequest) {
    return this.medical.createExam(req.user.id, dto);
  }

  @Put('exams/:id')
  updateExam(
    @Param('id') id: string,
    @Body() dto: SaveExamDto,
    @Req() req: AuthedRequest,
  ) {
    return this.medical.updateExam(req.user.id, id, dto);
  }

  @Delete('exams/:id')
  removeExam(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.medical.remove('exam', req.user.id, id);
  }

  @Post('exams/:id/pdf')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_PDF_SIZE } }),
  )
  attachExamPdf(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    return this.medical.attachExamPdf(req.user.id, id, file);
  }

  @Get('exams/:id/pdf')
  async examPdf(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { buffer, fileName } = await this.medical.examPdf(req.user.id, id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `inline; filename="${encodeURIComponent(fileName)}"`,
    });
  }

  @Post('illnesses')
  createIllness(@Body() dto: SaveIllnessDto, @Req() req: AuthedRequest) {
    return this.medical.createIllness(req.user.id, dto);
  }

  @Put('illnesses/:id')
  updateIllness(
    @Param('id') id: string,
    @Body() dto: SaveIllnessDto,
    @Req() req: AuthedRequest,
  ) {
    return this.medical.updateIllness(req.user.id, id, dto);
  }

  @Delete('illnesses/:id')
  removeIllness(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.medical.remove('illness', req.user.id, id);
  }

  @Post('vision')
  createVision(@Body() dto: SaveVisionDto, @Req() req: AuthedRequest) {
    return this.medical.createVision(req.user.id, dto);
  }

  @Put('vision/:id')
  updateVision(
    @Param('id') id: string,
    @Body() dto: SaveVisionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.medical.updateVision(req.user.id, id, dto);
  }

  @Delete('vision/:id')
  removeVision(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.medical.remove('vision', req.user.id, id);
  }

  @Post('lenses')
  createLens(@Body() dto: SaveContactLensDto, @Req() req: AuthedRequest) {
    return this.medical.createLens(req.user.id, dto);
  }

  @Put('lenses/:id')
  updateLens(
    @Param('id') id: string,
    @Body() dto: SaveContactLensDto,
    @Req() req: AuthedRequest,
  ) {
    return this.medical.updateLens(req.user.id, id, dto);
  }

  @Delete('lenses/:id')
  removeLens(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.medical.remove('lens', req.user.id, id);
  }
}
