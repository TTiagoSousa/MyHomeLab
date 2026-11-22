import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { getVersionOverview, listReleases } from './helpers/getVersionOverview';
import { noteLanguage } from './helpers/getReleases';
import { requestUpdate } from './helpers/requestUpdate';
import { readUpdateStatus } from './helpers/updateFiles';

@Injectable()
export class SystemService {
  constructor(private readonly prisma: PrismaService) {}

  version(lang?: string) {
    return getVersionOverview(noteLanguage(lang));
  }

  releases(force: boolean, lang?: string) {
    return listReleases(force, noteLanguage(lang));
  }

  update(version: string) {
    return requestUpdate(this.prisma, version);
  }

  updateStatus() {
    return readUpdateStatus();
  }
}
