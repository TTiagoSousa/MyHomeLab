import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { HealthService } from './health.service';
import { HeartRateService } from './heart-rate.service';
import { SkinTemperatureService } from './skin-temperature.service';
import { BloodOxygenService } from './blood-oxygen.service';
import { StressService } from './stress.service';
import { ExerciseService } from './exercise.service';
import { StepsService } from './steps.service';
import { SaveManualWorkoutDto } from './dto/save-manual-workout.dto';
import { SetWorkoutPartsDto } from './dto/set-workout-parts.dto';
import { WeightService } from './weight.service';
import { WaterService } from './water.service';
import { SaveWeightDto } from './dto/save-weight.dto';
import { SaveWaterDto } from './dto/save-water.dto';

type AuthedRequest = Request & { user: JwtPayload };

/** O browser só manda os ficheiros da pasta do sono (uns 4 MB); estes limites chegam com folga. */
const MAX_FILES = 60;
const MAX_FILE_SIZE = 30 * 1024 * 1024;

/**
 * O batimento e a temperatura da pele vêm cada um num só ficheiro montado
 * pelo browser (~6 MB e ~9 MB com o export de 16 meses).
 */
const MAX_READINGS_FILE_SIZE = 50 * 1024 * 1024;

@Controller('health')
@UseGuards(JwtAuthGuard)
export class HealthController {
  constructor(
    private readonly health: HealthService,
    private readonly heartRate: HeartRateService,
    private readonly skinTemperature: SkinTemperatureService,
    private readonly bloodOxygen: BloodOxygenService,
    private readonly stress: StressService,
    private readonly exercise: ExerciseService,
    private readonly steps: StepsService,
    private readonly weight: WeightService,
    private readonly water: WaterService,
  ) {}

  @Post('import/huawei')
  @HttpCode(200)
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  importHuawei(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: AuthedRequest,
  ) {
    return this.health.importHuawei(req.user.id, files);
  }

  @Get('summary')
  summary(@Req() req: AuthedRequest) {
    return this.health.summary(req.user.id);
  }

  @Get('sleep')
  sleep(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Req() req: AuthedRequest,
  ) {
    return this.health.sleep(req.user.id, days);
  }

  @Get('sleep/:id')
  sleepSession(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.health.sleepSession(req.user.id, id);
  }

  @Post('import/huawei/heart')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_READINGS_FILE_SIZE } }),
  )
  async importHuaweiHeart(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    const result = await this.heartRate.importHuawei(req.user.id, file);
    // O batimento pode chegar depois dos treinos registados à mão: cruza-os outra vez.
    await this.exercise.syncAllHeartRate(req.user.id);
    return result;
  }

  @Get('heart')
  heart(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Req() req: AuthedRequest,
  ) {
    return this.heartRate.days(req.user.id, days);
  }

  @Get('heart/:id')
  heartDay(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.heartRate.day(req.user.id, id);
  }

  @Post('import/huawei/skin-temperature')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_READINGS_FILE_SIZE } }),
  )
  importHuaweiSkinTemperature(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    return this.skinTemperature.importHuawei(req.user.id, file);
  }

  @Get('skin-temperature')
  skinTemperatureDays(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Req() req: AuthedRequest,
  ) {
    return this.skinTemperature.days(req.user.id, days);
  }

  @Get('skin-temperature/:id')
  skinTemperatureDay(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.skinTemperature.day(req.user.id, id);
  }

  @Post('import/huawei/blood-oxygen')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_READINGS_FILE_SIZE } }),
  )
  importHuaweiBloodOxygen(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    return this.bloodOxygen.importHuawei(req.user.id, file);
  }

  @Get('blood-oxygen')
  bloodOxygenDays(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Req() req: AuthedRequest,
  ) {
    return this.bloodOxygen.days(req.user.id, days);
  }

  @Get('blood-oxygen/:id')
  bloodOxygenDay(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.bloodOxygen.day(req.user.id, id);
  }

  @Post('import/huawei/stress')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_READINGS_FILE_SIZE } }),
  )
  importHuaweiStress(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    return this.stress.importHuawei(req.user.id, file);
  }

  @Get('stress')
  stressDays(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Req() req: AuthedRequest,
  ) {
    return this.stress.days(req.user.id, days);
  }

  @Get('stress/:id')
  stressDay(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.stress.day(req.user.id, id);
  }

  @Post('import/huawei/exercise')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_READINGS_FILE_SIZE } }),
  )
  importHuaweiExercise(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    return this.exercise.importHuawei(req.user.id, file);
  }

  @Get('exercise')
  exerciseDays(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Req() req: AuthedRequest,
  ) {
    return this.exercise.exercise(req.user.id, days);
  }

  @Get('exercise/types')
  exerciseTypes() {
    return this.exercise.types();
  }

  @Post('exercise/workouts')
  createWorkout(@Body() dto: SaveManualWorkoutDto, @Req() req: AuthedRequest) {
    return this.exercise.createManual(req.user.id, dto);
  }

  @Get('exercise/workouts/:id')
  workout(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.exercise.workout(req.user.id, id);
  }

  @Put('exercise/workouts/:id')
  updateWorkout(
    @Param('id') id: string,
    @Body() dto: SaveManualWorkoutDto,
    @Req() req: AuthedRequest,
  ) {
    return this.exercise.updateManual(req.user.id, id, dto);
  }

  @Delete('exercise/workouts/:id')
  deleteWorkout(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.exercise.deleteManual(req.user.id, id);
  }

  @Get('exercise/workouts/:id/parts/candidates')
  partCandidates(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.exercise.partCandidates(req.user.id, id);
  }

  @Put('exercise/workouts/:id/parts')
  setParts(
    @Param('id') id: string,
    @Body() dto: SetWorkoutPartsDto,
    @Req() req: AuthedRequest,
  ) {
    return this.exercise.setParts(req.user.id, id, dto);
  }

  @Delete('exercise/workouts/:id/parent')
  detachPart(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.exercise.detachPart(req.user.id, id);
  }

  @Post('exercise/workouts/:id/sync')
  @HttpCode(200)
  syncWorkout(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.exercise.syncManual(req.user.id, id);
  }

  @Post('exercise/sync')
  @HttpCode(200)
  syncWorkouts(@Req() req: AuthedRequest) {
    return this.exercise.syncAllHeartRate(req.user.id);
  }

  @Post('import/huawei/steps')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_READINGS_FILE_SIZE } }),
  )
  importHuaweiSteps(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    return this.steps.importHuawei(req.user.id, file);
  }

  @Get('steps')
  stepsDays(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Req() req: AuthedRequest,
  ) {
    return this.steps.days(req.user.id, days);
  }

  @Get('steps/:id')
  stepsDay(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.steps.day(req.user.id, id);
  }

  @Get('weight')
  weightEntries(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Req() req: AuthedRequest,
  ) {
    return this.weight.weight(req.user.id, days);
  }

  @Post('weight')
  addWeight(@Body() dto: SaveWeightDto, @Req() req: AuthedRequest) {
    return this.weight.create(req.user.id, dto);
  }

  @Delete('weight/:id')
  removeWeight(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.weight.remove(req.user.id, id);
  }

  @Get('water')
  waterDays(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Req() req: AuthedRequest,
  ) {
    return this.water.water(req.user.id, days);
  }

  @Post('water')
  addWater(@Body() dto: SaveWaterDto, @Req() req: AuthedRequest) {
    return this.water.create(req.user.id, dto);
  }

  @Delete('water/:id')
  removeWater(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.water.remove(req.user.id, id);
  }
}
