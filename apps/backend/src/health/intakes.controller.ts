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
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { IntakesService } from './intakes.service';
import {
  SaveIntakeDto,
  SaveIntakeItemDto,
  SaveIntakeSettingsDto,
} from './dto/save-health-logs.dto';

type AuthedRequest = Request & { user: JwtPayload };

/** Café, álcool e suplementos: registos, itens próprios e limites. */
@Controller('health/intakes')
@UseGuards(JwtAuthGuard)
export class IntakesController {
  constructor(private readonly intakes: IntakesService) {}

  @Get()
  list(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Req() req: AuthedRequest,
  ) {
    return this.intakes.intakes(req.user.id, days);
  }

  @Post()
  create(@Body() dto: SaveIntakeDto, @Req() req: AuthedRequest) {
    return this.intakes.create(req.user.id, dto);
  }

  @Put('settings')
  saveSettings(@Body() dto: SaveIntakeSettingsDto, @Req() req: AuthedRequest) {
    return this.intakes.saveSettings(req.user.id, dto);
  }

  @Post('items')
  createItem(@Body() dto: SaveIntakeItemDto, @Req() req: AuthedRequest) {
    return this.intakes.createItem(req.user.id, dto);
  }

  @Put('items/:id')
  updateItem(
    @Param('id') id: string,
    @Body() dto: SaveIntakeItemDto,
    @Req() req: AuthedRequest,
  ) {
    return this.intakes.updateItem(req.user.id, id, dto);
  }

  @Delete('items/:id')
  removeItem(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.intakes.removeItem(req.user.id, id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: SaveIntakeDto,
    @Req() req: AuthedRequest,
  ) {
    return this.intakes.update(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.intakes.remove(req.user.id, id);
  }
}
