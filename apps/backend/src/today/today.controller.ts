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
import { TodayService } from './today.service';
import { CreateShortcutDto } from './dto/create-shortcut.dto';
import { SetWeatherDto } from './dto/set-weather.dto';

type AuthRequest = Request & { user: JwtPayload };

@Controller('today')
@UseGuards(JwtAuthGuard)
export class TodayController {
  constructor(private readonly today: TodayService) {}

  @Get('shortcuts')
  shortcuts(@Req() req: AuthRequest) {
    return this.today.shortcuts(req.user.id);
  }

  @Post('shortcuts')
  addShortcut(@Body() dto: CreateShortcutDto, @Req() req: AuthRequest) {
    return this.today.addShortcut(req.user.id, dto);
  }

  @Delete('shortcuts/:id')
  @HttpCode(204)
  removeShortcut(@Param('id') id: string, @Req() req: AuthRequest) {
    return this.today.removeShortcut(req.user.id, id);
  }

  @Get('weather')
  weather(@Req() req: AuthRequest) {
    return this.today.weather(req.user.id);
  }

  @Put('weather')
  setWeather(@Body() dto: SetWeatherDto, @Req() req: AuthRequest) {
    return this.today.setWeather(req.user.id, dto.city);
  }

  @Delete('weather')
  @HttpCode(204)
  clearWeather(@Req() req: AuthRequest) {
    return this.today.clearWeather(req.user.id);
  }
}
