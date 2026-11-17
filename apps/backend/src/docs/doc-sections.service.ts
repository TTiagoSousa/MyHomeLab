import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDocSectionDto, UpdateDocSectionDto } from './dto/doc.dto';

/**
 * As secções dos Documentos que o utilizador cria ("Casa", "Casa → Rede"…), em árvore.
 * Apagar uma secção nunca apaga documentos: eles e as subsecções sobem um nível.
 */
@Injectable()
export class DocSectionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.docSection.findMany({
      where: { userId },
      select: { id: true, name: true, parentId: true, position: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });
  }

  async create(userId: string, input: CreateDocSectionDto) {
    const parentId = input.parentId || null;
    if (parentId) await this.findOwned(userId, parentId);
    return this.prisma.docSection.create({
      data: { userId, name: input.name.trim(), parentId },
      select: { id: true, name: true, parentId: true, position: true },
    });
  }

  async update(userId: string, id: string, input: UpdateDocSectionDto) {
    await this.findOwned(userId, id);
    const parentId =
      input.parentId === undefined ? undefined : input.parentId || null;
    if (parentId) {
      await this.findOwned(userId, parentId);
      if (await this.isInside(parentId, id)) {
        throw new BadRequestException(
          'Uma secção não pode ir para dentro dela própria.',
        );
      }
    }
    return this.prisma.docSection.update({
      where: { id },
      data: { name: input.name?.trim(), parentId },
      select: { id: true, name: true, parentId: true, position: true },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const section = await this.findOwned(userId, id);
    await this.prisma.$transaction([
      this.prisma.docSection.updateMany({
        where: { parentId: id },
        data: { parentId: section.parentId },
      }),
      this.prisma.doc.updateMany({
        where: { sectionId: id },
        data: { sectionId: section.parentId },
      }),
      this.prisma.docSection.delete({ where: { id } }),
    ]);
  }

  async findOwned(userId: string, id: string) {
    const section = await this.prisma.docSection.findFirst({
      where: { id, userId },
    });
    if (!section) throw new NotFoundException('Secção não encontrada');
    return section;
  }

  /** Se `candidate` é a própria `ancestor` ou está dentro dela. */
  private async isInside(candidate: string, ancestor: string) {
    let current: string | null = candidate;
    for (let depth = 0; current && depth < 50; depth += 1) {
      if (current === ancestor) return true;
      const section: { parentId: string | null } | null =
        await this.prisma.docSection.findUnique({
          where: { id: current },
          select: { parentId: true },
        });
      current = section?.parentId ?? null;
    }
    return false;
  }
}
