import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { OpenGymService } from './opengym.service';
import {
  ConnectOpenGymDto,
  UpdateOpenGymDto,
  UseOpenGymAppDto,
} from './dto/opengym.dto';

type AuthedRequest = Request & { user: JwtPayload };

/** A ligação ao openGym (Saúde → Importar dados de saúde → openGym). */
@Controller('health/opengym')
@UseGuards(JwtAuthGuard)
export class OpenGymController {
  constructor(private readonly openGym: OpenGymService) {}

  @Get()
  connection(@Req() req: AuthedRequest) {
    return this.openGym.connection(req.user.id);
  }

  /** Se o openGym está online agora (a bolinha verde no modal). */
  @Get('status')
  status(@Req() req: AuthedRequest) {
    return this.openGym.status(req.user.id);
  }

  @Post()
  @HttpCode(200)
  connect(@Body() dto: ConnectOpenGymDto, @Req() req: AuthedRequest) {
    return this.openGym.connect(req.user.id, dto);
  }

  /** Ler os treinos pela app openGym já ligada (sem código). */
  @Post('app')
  @HttpCode(200)
  useApp(@Body() dto: UseOpenGymAppDto, @Req() req: AuthedRequest) {
    return this.openGym.useApp(req.user.id, dto.accountId);
  }

  @Put()
  update(@Body() dto: UpdateOpenGymDto, @Req() req: AuthedRequest) {
    return this.openGym.update(req.user.id, dto);
  }

  @Post('sync')
  @HttpCode(200)
  sync(@Req() req: AuthedRequest) {
    return this.openGym.syncNow(req.user.id);
  }

  @Delete()
  disconnect(
    @Query('removeWorkouts') removeWorkouts: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    return this.openGym.disconnect(req.user.id, removeWorkouts === 'true');
  }
}
