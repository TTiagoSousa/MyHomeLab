import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AiCredentialService } from 'src/ai-credential/ai-credential.service';
import { aiFailure } from 'src/ai-credential/ai-providers';
import { LabResult } from 'src/generated/prisma/client/client';
import { SaveLabReportDto } from './dto/save-lab-report.dto';
import { extractLabReport } from './labs/extractLabReport';
import { LAB_ANALYTES, resolveAnalyteKey } from './labs/labAnalytes';
import { labFlag } from './labs/labFlag';

const dayOf = (date: Date) => date.toISOString().slice(0, 10);

/** A referência escrita a partir dos limites, quando só vieram os números. */
const referenceText = (low: number | null, high: number | null) => {
  if (low != null && high != null) return `${low}-${high}`;
  if (high != null) return `<${high}`;
  if (low != null) return `>${low}`;
  return null;
};

/** O resultado como sai para o browser: sem o utilizador nem o relatório. */
const toResultView = (result: LabResult) => ({
  key: result.key,
  name: result.name,
  section: result.section,
  group: result.group,
  value: result.value,
  valueText: result.valueText,
  unit: result.unit,
  refLow: result.refLow,
  refHigh: result.refHigh,
  refText: result.refText,
  flag: result.flag,
});

/**
 * As análises clínicas. Um PDF é lido pelo Claude (com a chave do utilizador)
 * e devolvido como rascunho; só se guarda depois de o utilizador o rever. Cada
 * parâmetro fica numa linha, com a chave normalizada que junta o histórico.
 */
@Injectable()
export class LabsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiCredentials: AiCredentialService,
  ) {}

  /** Lê um PDF e devolve os resultados para rever. Não guarda nada. */
  async extract(userId: string, file?: { buffer: Buffer; mimetype: string }) {
    if (!file?.buffer?.length || !/pdf/i.test(file.mimetype)) {
      throw new BadRequestException({
        code: 'HEALTH_LAB_NOT_PDF',
        message: 'Escolhe um ficheiro PDF com as análises.',
      });
    }
    const ai = await this.aiCredentials.requireClient(userId);
    try {
      const report = await extractLabReport(ai, file.buffer);
      if (!report.results.length) {
        throw new BadRequestException({
          code: 'HEALTH_LAB_EMPTY',
          message: 'Não encontrei resultados de análises neste PDF.',
        });
      }
      return report;
    } catch (error) {
      throw aiFailure(error) ?? error;
    }
  }

  async create(userId: string, dto: SaveLabReportDto) {
    const report = await this.prisma.labReport.create({
      data: {
        userId,
        ...this.reportData(dto),
        results: { create: this.resultsData(userId, dto) },
      },
    });
    return { id: report.id };
  }

  /** Muda um relatório; os resultados são substituídos pelos do formulário. */
  async update(userId: string, id: string, dto: SaveLabReportDto) {
    await this.findOwned(userId, id);
    await this.prisma.labReport.update({
      where: { id },
      data: {
        ...this.reportData(dto),
        results: { deleteMany: {}, create: this.resultsData(userId, dto) },
      },
    });
    return { id };
  }

  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.labReport.delete({ where: { id } });
    return { deleted: true };
  }

  /** Guarda o PDF original junto do relatório. */
  async attachPdf(
    userId: string,
    id: string,
    file?: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    await this.findOwned(userId, id);
    if (!file?.buffer?.length || !/pdf/i.test(file.mimetype)) {
      throw new BadRequestException({
        code: 'HEALTH_LAB_NOT_PDF',
        message: 'Escolhe um ficheiro PDF com as análises.',
      });
    }
    await this.prisma.labReport.update({
      where: { id },
      data: {
        pdf: new Uint8Array(file.buffer),
        fileName: file.originalname.slice(0, 200),
      },
    });
    return { attached: true };
  }

  async pdf(userId: string, id: string) {
    const report = await this.prisma.labReport.findFirst({
      where: { id, userId },
      select: { pdf: true, fileName: true },
    });
    if (!report?.pdf) throw new NotFoundException('Este relatório não tem PDF');
    return {
      buffer: Buffer.from(report.pdf),
      fileName: report.fileName ?? 'analises.pdf',
    };
  }

  /** Os relatórios, do mais recente para o mais antigo, com quantos valores estão fora. */
  async reports(userId: string) {
    const reports = await this.prisma.labReport.findMany({
      where: { userId },
      orderBy: { collectedAt: 'desc' },
      select: {
        id: true,
        collectedAt: true,
        lab: true,
        source: true,
        fileName: true,
        notes: true,
        results: { select: { flag: true } },
      },
    });
    return reports.map(({ results, collectedAt, ...report }) => ({
      ...report,
      collectedAt: dayOf(collectedAt),
      hasPdf: report.fileName != null,
      results: results.length,
      outOfRange: results.filter((result) => result.flag).length,
    }));
  }

  async report(userId: string, id: string) {
    const report = await this.prisma.labReport.findFirst({
      where: { id, userId },
      include: { results: { orderBy: { position: 'asc' } } },
    });
    if (!report) throw new NotFoundException('Relatório não encontrado');
    return {
      id: report.id,
      collectedAt: dayOf(report.collectedAt),
      lab: report.lab,
      source: report.source,
      notes: report.notes,
      fileName: report.fileName,
      hasPdf: report.fileName != null,
      results: report.results.map(toResultView),
    };
  }

  /**
   * Cada parâmetro com o valor mais recente, quantas vezes foi medido e se o
   * último está fora da referência. É a vista "parâmetros" da página.
   */
  async parameters(userId: string) {
    const results = await this.prisma.labResult.findMany({
      where: { userId },
      include: { report: { select: { id: true, collectedAt: true } } },
    });
    // Por chave, do mais recente para o mais antigo: o primeiro é o valor
    // atual e o segundo serve para a variação desde a análise anterior.
    const byKey = new Map<string, (typeof results)[number][]>();
    for (const result of results) {
      byKey.set(result.key, [...(byKey.get(result.key) ?? []), result]);
    }
    return [...byKey.values()]
      .map((history) => {
        history.sort(
          (a, b) =>
            b.report.collectedAt.getTime() - a.report.collectedAt.getTime(),
        );
        const [result, previous] = history;
        return {
          ...toResultView(result),
          reportId: result.report.id,
          date: dayOf(result.report.collectedAt),
          count: history.length,
          previousValue: previous?.value ?? null,
          previousDate: previous ? dayOf(previous.report.collectedAt) : null,
        };
      })
      .sort(
        (a, b) =>
          (a.section ?? '').localeCompare(b.section ?? '') ||
          (a.group ?? '').localeCompare(b.group ?? '') ||
          a.name.localeCompare(b.name),
      );
  }

  /** O histórico de um parâmetro, do mais antigo para o mais recente. */
  async parameter(userId: string, key: string) {
    const results = await this.prisma.labResult.findMany({
      where: { userId, key },
      include: {
        report: { select: { id: true, collectedAt: true, lab: true } },
      },
    });
    if (!results.length)
      throw new NotFoundException('Parâmetro sem resultados');
    return results
      .sort(
        (a, b) =>
          a.report.collectedAt.getTime() - b.report.collectedAt.getTime(),
      )
      .map((result) => ({
        ...toResultView(result),
        reportId: result.report.id,
        date: dayOf(result.report.collectedAt),
        lab: result.report.lab,
      }));
  }

  /** O catálogo das chaves normalizadas, para meter análises à mão. */
  analytes() {
    return Object.entries(LAB_ANALYTES).map(([key, name]) => ({ key, name }));
  }

  private reportData(dto: SaveLabReportDto) {
    return {
      collectedAt: new Date(`${dto.collectedAt.slice(0, 10)}T00:00:00Z`),
      lab: dto.lab?.trim() || null,
      source: dto.source,
      notes: dto.notes?.trim() || null,
    };
  }

  private resultsData(userId: string, dto: SaveLabReportDto) {
    return dto.results.map((result, position) => {
      const data = {
        userId,
        key: resolveAnalyteKey(result.key, result.name),
        name: result.name.trim(),
        section: result.section?.trim() || null,
        group: result.group?.trim() || null,
        value: result.value ?? null,
        valueText: result.valueText?.trim() || null,
        unit: result.unit?.trim() || null,
        refLow: result.refLow ?? null,
        refHigh: result.refHigh ?? null,
        refText:
          result.refText?.trim() ||
          referenceText(result.refLow ?? null, result.refHigh ?? null),
        position,
      };
      return { ...data, flag: labFlag({ ...data, flag: result.flag }) };
    });
  }

  private async findOwned(userId: string, id: string) {
    const report = await this.prisma.labReport.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!report) throw new NotFoundException('Relatório não encontrado');
  }
}
