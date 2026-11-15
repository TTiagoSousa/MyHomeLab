import {
  Controller,
  Get,
  NotFoundException,
  Redirect,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { getAndroidRelease } from './helpers/getAndroidRelease';

@Controller('app')
export class AppReleaseController {
  /** Para a app Android saber se há versão nova. Qualquer utilizador com sessão. */
  @Get('android')
  @UseGuards(JwtAuthGuard)
  android() {
    return getAndroidRelease();
  }

  /**
   * Um link fixo para o APK da versão instalada — serve para um link no README. Sem
   * sessão: o repositório é público e o APK também; isto só poupa procurar a release.
   */
  @Get('android/download')
  @Redirect()
  async download() {
    const { downloadUrl } = await getAndroidRelease();
    if (!downloadUrl) {
      throw new NotFoundException('Ainda não há nenhuma versão da app.');
    }
    return { url: downloadUrl, statusCode: 302 };
  }
}
