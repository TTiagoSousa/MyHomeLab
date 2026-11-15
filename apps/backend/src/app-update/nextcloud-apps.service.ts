import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  AppUpdateStatus,
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import { cleanVersion, compareVersions } from 'src/integrations/releases';
import {
  NextcloudApp,
  nextcloudAppUpdates,
  nextcloudForAccount,
  nextcloudStoreApps,
} from 'src/nextcloud/nextcloud.client';
import { UpdateRecordService } from './update-record.service';
import { repositoryFromUrl } from './helpers/releaseSources';
import { isAvailable } from './helpers/updateFields';
import { newerVersion } from './helpers/newerVersion';
import { now } from './helpers/updateDates';

/** O grupo das apps dentro do Nextcloud (componentGroup). */
export const NEXTCLOUD_APPS_GROUP = 'apps';

const STILL_OPEN: AppUpdateStatus[] = [
  AppUpdateStatus.NEW,
  AppUpdateStatus.STUDY,
  AppUpdateStatus.STUDYING,
  AppUpdateStatus.READY,
  AppUpdateStatus.WAITING,
  AppUpdateStatus.LATER,
];

/**
 * As apps dentro do Nextcloud (Calendar, Tasks, Talk…): cada versão nova na App
 * Store vira uma atualização própria (tarefa, registo, estudo), à parte da do
 * próprio Nextcloud. Instalam-se com o occ no CT, como a app (snapshot antes).
 */
@Injectable()
export class NextcloudAppsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly record: UpdateRecordService,
  ) {}

  /**
   * Vê as apps ligadas e a App Store: abre uma atualização por app com versão
   * nova; uma já instalada (por nós ou à mão) passa a Verifying ou fica feita.
   * Precisa de uma conta admin (sem ela o Nextcloud não diz as versões).
   */
  async checkNextcloudApps(account: ConnectedAccount): Promise<void> {
    if (
      account.provider !== ConnectionProvider.NEXTCLOUD ||
      !account.isActive ||
      account.disconnectedAt ||
      !account.caldavPassword
    ) {
      return;
    }
    const client = nextcloudForAccount(account);
    // Sem administrador o Nextcloud não diz as apps: fica só a versão do servidor.
    if (!(await client.me()).isAdmin) return;
    const [{ version }, installed] = await Promise.all([
      client.status(),
      client.apps(),
    ]);
    const updates = nextcloudAppUpdates(
      installed,
      await nextcloudStoreApps(version),
    );
    const existing = await this.prisma.appUpdate.findMany({
      where: { accountId: account.id, component: { not: null } },
      orderBy: { createdAt: 'desc' },
    });

    await this.closeInstalled(existing, installed);

    for (const item of updates) {
      const mine = existing.filter((update) => update.component === item.id);
      const open = mine.find((update) => STILL_OPEN.includes(update.status));
      if (open) {
        if (cleanVersion(open.toVersion) === item.latest) continue;
        const newer = newerVersion(open, item.latest);
        await this.record.save(
          open,
          { toVersion: item.latest, ...newer.data },
          newer.text,
        );
        continue;
      }
      // Uma versão já tratada (feita, cancelada, falhada) não abre outra.
      if (mine.some((update) => cleanVersion(update.toVersion) === item.latest))
        continue;
      const created = await this.prisma.appUpdate.create({
        data: {
          userId: account.userId,
          accountId: account.id,
          component: item.id,
          componentTitle: item.name,
          componentGroup: NEXTCLOUD_APPS_GROUP,
          repository: repositoryFromUrl(item.website),
          fromVersion: item.installed,
          toVersion: item.latest,
          releaseUrl: item.releaseUrl,
        },
      });
      await this.record.save(
        created,
        {},
        `Saiu a versão ${item.latest} da app ${item.name} do Nextcloud (está instalada a ${item.installed}). Fica disponível (um agente abre-a quando a tratar).`,
      );
    }
  }

  /** As em aberto cuja app já está na versão nova (instalada fora do MyHomeLab ou à espera do "feito quando"). */
  private async closeInstalled(
    existing: { id: string; component: string | null; toVersion: string }[],
    installed: NextcloudApp[],
  ) {
    const versions = new Map(installed.map((app) => [app.id, app.version]));
    for (const row of existing) {
      const version = row.component ? versions.get(row.component) : undefined;
      if (!version || compareVersions(version, row.toVersion) < 0) continue;
      const open = await this.prisma.appUpdate.findUnique({
        where: { id: row.id },
      });
      if (!open || !STILL_OPEN.includes(open.status)) continue;
      await this.record.save(
        open,
        isAvailable(open)
          ? { status: AppUpdateStatus.DONE, finishedAt: now() }
          : { status: AppUpdateStatus.VERIFYING, verifyStartedAt: null },
        isAvailable(open)
          ? `A app já está na ${version} no Nextcloud (atualizada fora do MyHomeLab).`
          : `✅ A app já está na ${version} no Nextcloud. Falta confirmar o "feito quando".`,
      );
    }
  }
}
