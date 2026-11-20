import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import { ensureFreshAccessToken } from 'src/connected-account/helpers/ensureFreshAccessToken';
import {
  ConnectedAccount,
  ConnectionProvider,
  DriveLink,
} from 'src/generated/prisma/client/client';
import { DriveFile, FOLDER, driveFileId, getDriveFile } from './drive.client';

/** Até onde se sobe nas pastas para saber se um ficheiro está dentro de uma pasta ligada. */
const MAX_DEPTH = 12;

export interface DriveSession {
  account: ConnectedAccount;
  token: string;
}

export type DriveLinkInfo = DriveLink & {
  project: { id: string; name: string };
};

/**
 * O Google Drive de cada utilizador: a conta (o token renovado), as pastas e ficheiros
 * ligados a projetos e a regra do código — o Jarvis lê o Drive todo, mas só altera o
 * que estiver ligado a um projeto (o ficheiro, ou dentro de uma pasta ligada).
 */
@Injectable()
export class DriveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: PrismaConnectedAccountRepository,
  ) {}

  private async driveAccounts(userId: string) {
    return this.prisma.connectedAccount.findMany({
      where: {
        userId,
        provider: ConnectionProvider.GOOGLE_DRIVE,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** A conta do Drive (pelo email, ou a única) com o token renovado. */
  async session(userId: string, accountEmail?: string): Promise<DriveSession> {
    const all = await this.driveAccounts(userId);
    if (!all.length) {
      throw new BadRequestException(
        'Não há nenhum Google Drive ligado (Apps ligadas → Google Drive).',
      );
    }
    const wanted = accountEmail?.trim().toLowerCase();
    const account = wanted
      ? all.find((item) => item.emailAddress?.toLowerCase() === wanted)
      : all[0];
    if (!account) {
      throw new BadRequestException(
        `Não há um Drive ligado com ${accountEmail}. Os ligados são: ${all.map((item) => item.emailAddress).join(', ')}.`,
      );
    }
    return {
      account,
      token: await ensureFreshAccessToken(account.id, this.accounts),
    };
  }

  private async ownAccount(userId: string, accountId: string) {
    const account = await this.prisma.connectedAccount.findFirst({
      where: {
        id: accountId,
        userId,
        provider: ConnectionProvider.GOOGLE_DRIVE,
      },
    });
    if (!account)
      throw new NotFoundException('Esta conta do Drive não existe.');
    return account;
  }

  links(userId: string, accountId?: string): Promise<DriveLinkInfo[]> {
    return this.prisma.driveLink.findMany({
      where: { userId, ...(accountId ? { accountId } : {}) },
      include: { project: { select: { id: true, name: true } } },
      orderBy: [{ project: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  /** Liga uma pasta ou um ficheiro (o link ou o id) a um projeto. */
  async link(
    userId: string,
    accountId: string,
    target: string,
    projectId: string,
  ): Promise<DriveLinkInfo> {
    const account = await this.ownAccount(userId, accountId);
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Este projeto não existe.');
    const token = await ensureFreshAccessToken(account.id, this.accounts);
    let file: DriveFile;
    try {
      file = await getDriveFile(token, driveFileId(target));
    } catch (error) {
      throw new BadRequestException(
        `Não encontrei isso no Drive: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return this.prisma.driveLink.upsert({
      where: {
        accountId_fileId_projectId: { accountId, fileId: file.id, projectId },
      },
      create: {
        userId,
        accountId,
        projectId,
        fileId: file.id,
        name: file.name,
        mimeType: file.mimeType,
      },
      update: { name: file.name, mimeType: file.mimeType },
      include: { project: { select: { id: true, name: true } } },
    });
  }

  async unlink(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.driveLink.deleteMany({
      where: { id, userId },
    });
    if (!count) throw new NotFoundException('Esta ligação já não existe.');
  }

  /** Liga também um ficheiro novo que o Jarvis criou (numa pasta ligada, ou a cópia convertida). */
  async linkCreated(
    session: DriveSession,
    file: DriveFile,
    projectIds: string[],
  ): Promise<void> {
    for (const projectId of projectIds) {
      await this.prisma.driveLink.upsert({
        where: {
          accountId_fileId_projectId: {
            accountId: session.account.id,
            fileId: file.id,
            projectId,
          },
        },
        create: {
          userId: session.account.userId,
          accountId: session.account.id,
          projectId,
          fileId: file.id,
          name: file.name,
          mimeType: file.mimeType,
        },
        update: {},
      });
    }
  }

  /**
   * As ligações que deixam mudar este ficheiro (ou criar dentro desta pasta): a dele, ou a
   * de uma pasta acima. Vazio = não se pode mudar.
   */
  async writableBy(
    session: DriveSession,
    fileId: string,
  ): Promise<DriveLinkInfo[]> {
    const links = await this.links(session.account.userId, session.account.id);
    if (!links.length) return [];
    const byFile = new Map<string, DriveLinkInfo[]>();
    for (const link of links) {
      byFile.set(link.fileId, [...(byFile.get(link.fileId) ?? []), link]);
    }
    let current = [fileId];
    const seen = new Set<string>();
    for (let depth = 0; depth < MAX_DEPTH && current.length; depth++) {
      const found = current.flatMap((id) => byFile.get(id) ?? []);
      if (found.length) return found;
      const next: string[] = [];
      for (const id of current) {
        if (seen.has(id)) continue;
        seen.add(id);
        const file = await getDriveFile(session.token, id).catch(() => null);
        next.push(...(file?.parents ?? []));
      }
      current = next;
    }
    return [];
  }

  /** Recusa com a explicação quando o ficheiro não está ligado a nenhum projeto. */
  async assertWritable(
    session: DriveSession,
    fileId: string,
    what: string,
  ): Promise<DriveLinkInfo[]> {
    const links = await this.writableBy(session, fileId);
    if (!links.length) {
      throw new Error(
        `não posso ${what}: não está ligado a nenhum projeto (nem está dentro de uma pasta ligada). Só altero o que ele ligar em Apps ligadas → Google Drive → Ligações a projetos. Diz-lhe isto e pede-lhe para o ligar.`,
      );
    }
    return links;
  }

  isFolder = (file: DriveFile) => file.mimeType === FOLDER;
}
