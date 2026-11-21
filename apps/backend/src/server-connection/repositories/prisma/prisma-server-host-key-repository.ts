import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  ServerHostKeyRepository,
  StoredSshHostKey,
} from '../server-host-key-repository';

@Injectable()
export class PrismaServerHostKeyRepository implements ServerHostKeyRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(serverId: string): Promise<StoredSshHostKey | null> {
    return this.prisma.serverConnection.findUnique({
      where: { id: serverId },
      select: { sshHostKey: true, sshHostKeyAt: true },
    });
  }

  // O `updateMany` com `sshHostKey: null` não deixa duas ligações em simultâneo
  // gravarem chaves diferentes: a segunda já não encontra a linha vazia.
  async storeIfEmpty(
    serverId: string,
    fingerprint: string,
    at: Date,
  ): Promise<boolean> {
    const result = await this.prisma.serverConnection.updateMany({
      where: { id: serverId, sshHostKey: null },
      data: { sshHostKey: fingerprint, sshHostKeyAt: at },
    });
    return result.count > 0;
  }

  async clear(serverId: string): Promise<void> {
    await this.prisma.serverConnection.update({
      where: { id: serverId },
      data: { sshHostKey: null, sshHostKeyAt: null },
    });
  }
}
