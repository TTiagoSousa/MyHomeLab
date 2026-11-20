import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { DriveService } from './drive.service';
import { CreateDriveLinkDto } from './dto/drive-link.dto';

type AuthedRequest = Request & { user: JwtPayload };

/** As pastas e os ficheiros do Drive ligados a projetos (só nesses o Jarvis altera). */
@Controller('google-drive')
@UseGuards(JwtAuthGuard)
export class GoogleDriveController {
  constructor(private readonly drive: DriveService) {}

  @Get(':accountId/links')
  links(@Param('accountId') accountId: string, @Req() req: AuthedRequest) {
    return this.drive.links(req.user.id, accountId);
  }

  @Post(':accountId/links')
  link(
    @Param('accountId') accountId: string,
    @Body() dto: CreateDriveLinkDto,
    @Req() req: AuthedRequest,
  ) {
    return this.drive.link(req.user.id, accountId, dto.target, dto.projectId);
  }

  @Delete('links/:id')
  @HttpCode(204)
  async unlink(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.drive.unlink(req.user.id, id);
  }
}
