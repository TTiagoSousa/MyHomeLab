import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { tmpdir } from 'os';
import { Readable } from 'stream';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'src/generated/prisma/client/client';
import { backupFileName } from './helpers/backupFileName';
import { InstanceBackupService } from './instance-backup.service';
import {
  RestoreInstanceBackupDto,
  SetInstanceBackupPasswordDto,
} from './dto/instance-backup.dto';

/** 5 GB: o backup leva os PDFs e as fotos que estão na base de dados. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

/** O backup do próprio MyHomeLab (Admin → Backup) — só para administradores. */
@Controller('backups/instance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class InstanceBackupController {
  constructor(private readonly instance: InstanceBackupService) {}

  @Get()
  settings() {
    return this.instance.settings();
  }

  @Put('password')
  setPassword(@Body() dto: SetInstanceBackupPasswordDto) {
    return this.instance.setPassword(dto.password);
  }

  /** Cria o backup agora e devolve o ficheiro (não fica guardado no servidor). */
  @Post('download')
  @HttpCode(200)
  async download(@Res({ passthrough: true }) res: Response) {
    const backup = await this.instance.create();
    const stream = backup.content as Readable;
    stream.once('close', () => void backup.cleanup?.());
    res.set({
      'Content-Type': 'application/zip',
      // Em desenvolvimento a app está noutra origem: sem isto não lê o nome do ficheiro.
      'Access-Control-Expose-Headers': 'Content-Disposition',
      'Content-Disposition': `attachment; filename="${backupFileName('myhomelab', new Date(), 'zip')}"`,
      ...(backup.sizeBytes
        ? { 'Content-Length': String(backup.sizeBytes) }
        : {}),
    });
    return new StreamableFile(stream);
  }

  @Post('restore')
  @HttpCode(202)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({ destination: tmpdir() }),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  restore(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: RestoreInstanceBackupDto,
  ) {
    if (!file)
      throw new BadRequestException('Escolhe o ficheiro do backup (.zip).');
    return this.instance.requestRestore(file.path, dto.password);
  }

  @Get('restore/status')
  restoreStatus() {
    return this.instance.restoreStatus();
  }
}
