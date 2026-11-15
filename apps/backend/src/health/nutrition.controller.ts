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
import { NutritionService } from './nutrition.service';
import { EstimateMealDto, SaveMealDto } from './dto/save-health-logs.dto';

type AuthedRequest = Request & { user: JwtPayload };

/** Uma foto do telemóvel tem uns MB; 10 MB chega. */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** A alimentação: refeições (com estimativa do Claude), café, álcool e suplementos. */
@Controller('health')
@UseGuards(JwtAuthGuard)
export class NutritionController {
  constructor(private readonly nutrition: NutritionService) {}

  @Get('nutrition')
  overview(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Req() req: AuthedRequest,
  ) {
    return this.nutrition.nutrition(req.user.id, days);
  }

  @Post('meals/estimate')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  estimate(
    @Body() dto: EstimateMealDto,
    @UploadedFile() photo: Express.Multer.File | undefined,
    @Req() req: AuthedRequest,
  ) {
    return this.nutrition.estimate(req.user.id, dto.text, photo);
  }

  @Post('meals')
  createMeal(@Body() dto: SaveMealDto, @Req() req: AuthedRequest) {
    return this.nutrition.createMeal(req.user.id, dto);
  }

  @Put('meals/:id')
  updateMeal(
    @Param('id') id: string,
    @Body() dto: SaveMealDto,
    @Req() req: AuthedRequest,
  ) {
    return this.nutrition.updateMeal(req.user.id, id, dto);
  }

  @Delete('meals/:id')
  removeMeal(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.nutrition.removeMeal(req.user.id, id);
  }

  @Post('meals/:id/photo')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: MAX_IMAGE_SIZE } }),
  )
  attachPhoto(
    @Param('id') id: string,
    @UploadedFile() photo: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    return this.nutrition.attachPhoto(req.user.id, id, photo);
  }

  @Get('meals/:id/photo')
  async photo(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { buffer, mime } = await this.nutrition.photo(req.user.id, id);
    return new StreamableFile(buffer, { type: mime });
  }
}
