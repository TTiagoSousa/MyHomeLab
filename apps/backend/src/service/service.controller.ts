import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ServiceService } from './service.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ReorderServiceDto } from './dto/reorder-service.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';

@Controller('service')
@UseGuards(JwtAuthGuard)
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Post()
  create(@Body() dto: CreateServiceDto, @Req() req: Request & { user: JwtPayload }) {
    return this.serviceService.create(dto, req.user.id);
  }

  @Get()
  findAll(@Req() req: Request & { user: JwtPayload }) {
    return this.serviceService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request & { user: JwtPayload }) {
    return this.serviceService.findOne(id, req.user.id);
  }

  @Patch('reorder')
  reorder(@Body() dto: ReorderServiceDto, @Req() req: Request & { user: JwtPayload }) {
    return this.serviceService.reorder(dto, req.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @Req() req: Request & { user: JwtPayload },
  ) {
    return this.serviceService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Req() req: Request & { user: JwtPayload }) {
    return this.serviceService.remove(id, req.user.id);
  }
}
