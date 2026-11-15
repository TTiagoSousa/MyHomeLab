import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
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
import { BodyService } from './body.service';
import {
  SaveBodyMeasurementDto,
  SaveProgressPhotoDto,
  SaveVitalDto,
} from './dto/save-health-logs.dto';

type AuthedRequest = Request & { user: JwtPayload };

/** Uma foto do telemóvel tem uns MB; 10 MB chega. */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** O corpo: medidas, fotos de progresso e medições (tensão, glicemia, temperatura). */
@Controller('health')
@UseGuards(JwtAuthGuard)
export class BodyController {
  constructor(private readonly body: BodyService) {}

  @Get('body')
  overview(
    @Query('days', new DefaultValuePipe(90), ParseIntPipe) days: number,
    @Req() req: AuthedRequest,
  ) {
    return this.body.body(req.user.id, days);
  }

  @Put('body/measurements')
  saveMeasurement(
    @Body() dto: SaveBodyMeasurementDto,
    @Req() req: AuthedRequest,
  ) {
    return this.body.saveMeasurement(req.user.id, dto);
  }

  @Delete('body/measurements/:id')
  removeMeasurement(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.body.removeMeasurement(req.user.id, id);
  }

  @Post('body/photos')
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  addPhoto(
    @Body() dto: SaveProgressPhotoDto,
    @UploadedFile() photo: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    return this.body.addPhoto(req.user.id, dto, photo);
  }

  @Get('body/photos/:id')
  async photo(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { buffer, mime } = await this.body.photo(req.user.id, id);
    return new StreamableFile(buffer, { type: mime });
  }

  @Delete('body/photos/:id')
  removePhoto(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.body.removePhoto(req.user.id, id);
  }

  @Post('vitals')
  createVital(@Body() dto: SaveVitalDto, @Req() req: AuthedRequest) {
    return this.body.createVital(req.user.id, dto);
  }

  @Delete('vitals/:id')
  removeVital(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.body.removeVital(req.user.id, id);
  }
}
