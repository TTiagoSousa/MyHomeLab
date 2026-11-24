import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { HealthMetricsService } from './health-metrics.service';
import { MeasurementDevicesService } from './measurement-devices.service';
import { HealthFormsService } from './health-forms.service';
import { SaveDeviceDto, UpdateDeviceDto } from './dto/save-device.dto';
import { SaveMetricValueDto } from './dto/save-metric-value.dto';
import {
  SaveHealthFormDto,
  SubmitHealthFormDto,
} from './dto/save-health-form.dto';
import { HEALTH_METRICS, type HealthMetric } from './helpers/healthMetrics';

type AuthedRequest = Request & { user: JwtPayload };

const known = (metric: string): HealthMetric => {
  if (!HEALTH_METRICS.includes(metric as HealthMetric)) {
    throw new BadRequestException('Métrica desconhecida');
  }
  return metric as HealthMetric;
};

/** As métricas com página própria, os aparelhos das pesagens e os formulários rápidos. */
@Controller('health')
@UseGuards(JwtAuthGuard)
export class HealthMetricsController {
  constructor(
    private readonly metrics: HealthMetricsService,
    private readonly devices: MeasurementDevicesService,
    private readonly forms: HealthFormsService,
  ) {}

  @Get('metrics/:metric')
  metric(
    @Param('metric') metric: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Req() req: AuthedRequest,
  ) {
    return this.metrics.metric(req.user.id, known(metric), days);
  }

  @Post('metrics/:metric')
  addMetricValue(
    @Param('metric') metric: string,
    @Body() dto: SaveMetricValueDto,
    @Req() req: AuthedRequest,
  ) {
    return this.metrics.addValue(req.user.id, known(metric), dto);
  }

  @Delete('metrics/:metric/:id')
  removeMetricValue(
    @Param('metric') metric: string,
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.metrics.removeValue(req.user.id, known(metric), id);
  }

  @Get('devices')
  listDevices(@Req() req: AuthedRequest) {
    return this.devices.list(req.user.id);
  }

  @Post('devices')
  createDevice(@Body() dto: SaveDeviceDto, @Req() req: AuthedRequest) {
    return this.devices.create(req.user.id, dto);
  }

  @Patch('devices/:id')
  updateDevice(
    @Param('id') id: string,
    @Body() dto: UpdateDeviceDto,
    @Req() req: AuthedRequest,
  ) {
    return this.devices.update(req.user.id, id, dto);
  }

  @Delete('devices/:id')
  removeDevice(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.devices.remove(req.user.id, id);
  }

  @Get('forms')
  listForms(@Req() req: AuthedRequest) {
    return this.forms.list(req.user.id);
  }

  @Post('forms')
  createForm(@Body() dto: SaveHealthFormDto, @Req() req: AuthedRequest) {
    return this.forms.create(req.user.id, dto);
  }

  @Put('forms/:id')
  updateForm(
    @Param('id') id: string,
    @Body() dto: SaveHealthFormDto,
    @Req() req: AuthedRequest,
  ) {
    return this.forms.update(req.user.id, id, dto);
  }

  @Delete('forms/:id')
  @HttpCode(204)
  async removeForm(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.forms.remove(req.user.id, id);
  }

  @Post('forms/:id/entries')
  submitForm(
    @Param('id') id: string,
    @Body() dto: SubmitHealthFormDto,
    @Req() req: AuthedRequest,
  ) {
    return this.forms.submit(req.user.id, id, dto);
  }
}
