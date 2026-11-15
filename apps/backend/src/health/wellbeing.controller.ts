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
import { WellbeingService } from './wellbeing.service';
import {
  CheckHabitDto,
  SaveFastDto,
  SaveHabitDto,
  SaveMoodDto,
} from './dto/save-health-logs.dto';

type AuthedRequest = Request & { user: JwtPayload };

/** A mente e os hábitos: humor, hábitos diários e jejuns. */
@Controller('health')
@UseGuards(JwtAuthGuard)
export class WellbeingController {
  constructor(private readonly wellbeing: WellbeingService) {}

  /** `today` é o dia local do browser (AAAA-MM-DD), para as sequências. */
  @Get('wellbeing')
  overview(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query('today') today: string,
    @Req() req: AuthedRequest,
  ) {
    return this.wellbeing.wellbeing(req.user.id, days, today);
  }

  @Put('mood/:day')
  saveMood(
    @Param('day') day: string,
    @Body() dto: SaveMoodDto,
    @Req() req: AuthedRequest,
  ) {
    return this.wellbeing.saveMood(req.user.id, day, dto);
  }

  @Delete('mood/:day')
  removeMood(@Param('day') day: string, @Req() req: AuthedRequest) {
    return this.wellbeing.removeMood(req.user.id, day);
  }

  @Post('habits')
  createHabit(@Body() dto: SaveHabitDto, @Req() req: AuthedRequest) {
    return this.wellbeing.createHabit(req.user.id, dto);
  }

  @Put('habits/:id')
  updateHabit(
    @Param('id') id: string,
    @Body() dto: SaveHabitDto,
    @Req() req: AuthedRequest,
  ) {
    return this.wellbeing.updateHabit(req.user.id, id, dto);
  }

  @Delete('habits/:id')
  removeHabit(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.wellbeing.removeHabit(req.user.id, id);
  }

  @Put('habits/:id/checks/:day')
  checkHabit(
    @Param('id') id: string,
    @Param('day') day: string,
    @Body() dto: CheckHabitDto,
    @Req() req: AuthedRequest,
  ) {
    return this.wellbeing.checkHabit(req.user.id, id, day, dto.done);
  }

  @Post('fasts')
  createFast(@Body() dto: SaveFastDto, @Req() req: AuthedRequest) {
    return this.wellbeing.createFast(req.user.id, dto);
  }

  @Put('fasts/:id')
  updateFast(
    @Param('id') id: string,
    @Body() dto: SaveFastDto,
    @Req() req: AuthedRequest,
  ) {
    return this.wellbeing.updateFast(req.user.id, id, dto);
  }

  @Delete('fasts/:id')
  removeFast(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.wellbeing.removeFast(req.user.id, id);
  }
}
