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
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { ServiceMonitorService } from './service-monitor.service';
import { SaveServiceMonitorDto } from './dto/save-service-monitor.dto';

type AuthedRequest = Request & { user: JwtPayload };

@Controller('service-monitors')
@UseGuards(JwtAuthGuard)
export class ServiceMonitorController {
  constructor(private readonly service: ServiceMonitorService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.service.list(req.user.id);
  }

  @Post()
  create(@Body() dto: SaveServiceMonitorDto, @Req() req: AuthedRequest) {
    return this.service.create(req.user.id, dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: SaveServiceMonitorDto,
    @Req() req: AuthedRequest,
  ) {
    return this.service.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.service.remove(req.user.id, id);
  }

  @Post(':id/check')
  @HttpCode(200)
  check(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.service.checkNow(req.user.id, id);
  }
}
