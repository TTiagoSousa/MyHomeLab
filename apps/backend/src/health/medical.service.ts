import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AiCredentialService } from 'src/ai-credential/ai-credential.service';
import { aiFailure } from 'src/ai-credential/ai-providers';
import {
  ContactLensCycle,
  IllnessEpisode,
  MedicalAppointment,
  Vaccine,
  VisionPrescription,
} from 'src/generated/prisma/client/client';
import {
  SaveAppointmentDto,
  SaveContactLensDto,
  SaveExamDto,
  SaveIllnessDto,
  SaveVaccineDto,
  SaveVisionDto,
} from './dto/save-health-logs.dto';
import { extractExamReport } from './ai/extractExamReport';
import { dateOnly } from './helpers/dateOnly';
import { dayOf } from './helpers/dayOf';
import { healthUpcoming } from './helpers/healthUpcoming';
import { requireAnthropic } from './helpers/requireAnthropic';

type MedicalModel =
  'appointment' | 'vaccine' | 'exam' | 'illness' | 'vision' | 'lens';

const NOT_FOUND: Record<MedicalModel, string> = {
  appointment: 'Consulta não encontrada',
  vaccine: 'Vacina não encontrada',
  exam: 'Exame não encontrado',
  illness: 'Episódio não encontrado',
  vision: 'Graduação não encontrada',
  lens: 'Lentes não encontradas',
};

const text = (value?: string | null) => value?.trim() || null;

const toAppointmentView = (appointment: MedicalAppointment) => ({
  id: appointment.id,
  at: appointment.at,
  timeZone: appointment.timeZone,
  specialty: appointment.specialty,
  doctor: appointment.doctor,
  place: appointment.place,
  reason: appointment.reason,
  notes: appointment.notes,
  followUpDate: dayOf(appointment.followUpDate),
});

const toVaccineView = (vaccine: Vaccine) => ({
  id: vaccine.id,
  name: vaccine.name,
  date: dayOf(vaccine.date),
  dose: vaccine.dose,
  nextDueDate: dayOf(vaccine.nextDueDate),
  notes: vaccine.notes,
});

const toIllnessView = (illness: IllnessEpisode) => ({
  id: illness.id,
  name: illness.name,
  startDate: dayOf(illness.startDate),
  endDate: dayOf(illness.endDate),
  symptoms: illness.symptoms,
  medication: illness.medication,
  notes: illness.notes,
});

const toVisionView = (vision: VisionPrescription) => ({
  id: vision.id,
  date: dayOf(vision.date),
  kind: vision.kind,
  rightSphere: vision.rightSphere,
  rightCylinder: vision.rightCylinder,
  rightAxis: vision.rightAxis,
  leftSphere: vision.leftSphere,
  leftCylinder: vision.leftCylinder,
  leftAxis: vision.leftAxis,
  addition: vision.addition,
  pupillaryMm: vision.pupillaryMm,
  notes: vision.notes,
});

const toLensView = (lens: ContactLensCycle) => ({
  id: lens.id,
  startDate: dayOf(lens.startDate),
  replaceDays: lens.replaceDays,
  replaceOn: dayOf(
    new Date(lens.startDate.getTime() + lens.replaceDays * 86_400_000),
  ),
  brand: lens.brand,
  notes: lens.notes,
});

/** Sem o PDF: só se lê quando se abre. */
const EXAM_SELECT = {
  id: true,
  date: true,
  kind: true,
  title: true,
  bodyPart: true,
  findings: true,
  summary: true,
  fileName: true,
} as const;

const toExamView = (exam: {
  id: string;
  date: Date;
  kind: string;
  title: string;
  bodyPart: string | null;
  findings: string | null;
  summary: string | null;
  fileName: string | null;
}) => ({
  id: exam.id,
  date: dayOf(exam.date),
  kind: exam.kind,
  title: exam.title,
  bodyPart: exam.bodyPart,
  findings: exam.findings,
  summary: exam.summary,
  hasPdf: Boolean(exam.fileName),
  fileName: exam.fileName,
});

/**
 * O histórico médico: consultas, vacinas, exames (o PDF pode ser lido pelo
 * Claude), episódios de doença, graduações (óculos e lentes) e as lentes de
 * contacto em uso. O que vem aí sai daqui para a página e para os lembretes.
 */
@Injectable()
export class MedicalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiCredentials: AiCredentialService,
  ) {}

  async medical(userId: string) {
    const [appointments, vaccines, exams, illnesses, vision, lenses] =
      await Promise.all([
        this.prisma.medicalAppointment.findMany({
          where: { userId },
          orderBy: { at: 'desc' },
        }),
        this.prisma.vaccine.findMany({
          where: { userId },
          orderBy: { date: 'desc' },
        }),
        this.prisma.medicalExam.findMany({
          where: { userId },
          orderBy: { date: 'desc' },
          select: EXAM_SELECT,
        }),
        this.prisma.illnessEpisode.findMany({
          where: { userId },
          orderBy: { startDate: 'desc' },
        }),
        this.prisma.visionPrescription.findMany({
          where: { userId },
          orderBy: { date: 'desc' },
        }),
        this.prisma.contactLensCycle.findMany({
          where: { userId },
          orderBy: { startDate: 'desc' },
        }),
      ]);

    return {
      upcoming: healthUpcoming({ appointments, vaccines, lenses }, new Date()),
      appointments: appointments.map(toAppointmentView),
      vaccines: vaccines.map(toVaccineView),
      exams: exams.map(toExamView),
      illnesses: illnesses.map(toIllnessView),
      vision: vision.map(toVisionView),
      lenses: lenses.map(toLensView),
    };
  }

  /** O que vem aí, para os lembretes (consultas, voltas, reforços e lentes). */
  async upcoming(userId: string, now: Date, aheadDays: number) {
    const [appointments, vaccines, lenses] = await Promise.all([
      this.prisma.medicalAppointment.findMany({ where: { userId } }),
      this.prisma.vaccine.findMany({ where: { userId } }),
      this.prisma.contactLensCycle.findMany({ where: { userId } }),
    ]);
    return healthUpcoming(
      { appointments, vaccines, lenses },
      now,
      aheadDays,
      0,
    );
  }

  async createAppointment(userId: string, dto: SaveAppointmentDto) {
    const appointment = await this.prisma.medicalAppointment.create({
      data: { userId, ...this.appointmentData(dto) },
    });
    return toAppointmentView(appointment);
  }

  async updateAppointment(userId: string, id: string, dto: SaveAppointmentDto) {
    await this.findOwned('appointment', userId, id);
    const appointment = await this.prisma.medicalAppointment.update({
      where: { id },
      data: this.appointmentData(dto),
    });
    return toAppointmentView(appointment);
  }

  async createVaccine(userId: string, dto: SaveVaccineDto) {
    const vaccine = await this.prisma.vaccine.create({
      data: { userId, ...this.vaccineData(dto) },
    });
    return toVaccineView(vaccine);
  }

  async updateVaccine(userId: string, id: string, dto: SaveVaccineDto) {
    await this.findOwned('vaccine', userId, id);
    const vaccine = await this.prisma.vaccine.update({
      where: { id },
      data: this.vaccineData(dto),
    });
    return toVaccineView(vaccine);
  }

  /** Lê o PDF de um exame e devolve um rascunho para rever. Não guarda nada. */
  async extractExam(
    userId: string,
    file?: { buffer: Buffer; mimetype: string },
  ) {
    this.checkPdf(file);
    const anthropic = await requireAnthropic(this.aiCredentials, userId);
    try {
      return await extractExamReport(anthropic, file!.buffer);
    } catch (error) {
      throw aiFailure(error) ?? error;
    }
  }

  async createExam(userId: string, dto: SaveExamDto) {
    const exam = await this.prisma.medicalExam.create({
      data: { userId, ...this.examData(dto) },
      select: EXAM_SELECT,
    });
    return toExamView(exam);
  }

  async updateExam(userId: string, id: string, dto: SaveExamDto) {
    await this.findOwned('exam', userId, id);
    const exam = await this.prisma.medicalExam.update({
      where: { id },
      data: this.examData(dto),
      select: EXAM_SELECT,
    });
    return toExamView(exam);
  }

  async attachExamPdf(
    userId: string,
    id: string,
    file?: { buffer: Buffer; mimetype: string; originalname: string },
  ) {
    await this.findOwned('exam', userId, id);
    this.checkPdf(file);
    await this.prisma.medicalExam.update({
      where: { id },
      data: {
        pdf: new Uint8Array(file!.buffer),
        fileName: file!.originalname.slice(0, 200),
      },
    });
    return { attached: true };
  }

  async examPdf(userId: string, id: string) {
    const exam = await this.prisma.medicalExam.findFirst({
      where: { id, userId },
      select: { pdf: true, fileName: true },
    });
    if (!exam?.pdf) throw new NotFoundException('Este exame não tem PDF');
    return {
      buffer: Buffer.from(exam.pdf),
      fileName: exam.fileName ?? 'exame.pdf',
    };
  }

  async createIllness(userId: string, dto: SaveIllnessDto) {
    const illness = await this.prisma.illnessEpisode.create({
      data: { userId, ...this.illnessData(dto) },
    });
    return toIllnessView(illness);
  }

  async updateIllness(userId: string, id: string, dto: SaveIllnessDto) {
    await this.findOwned('illness', userId, id);
    const illness = await this.prisma.illnessEpisode.update({
      where: { id },
      data: this.illnessData(dto),
    });
    return toIllnessView(illness);
  }

  async createVision(userId: string, dto: SaveVisionDto) {
    const vision = await this.prisma.visionPrescription.create({
      data: { userId, ...this.visionData(dto) },
    });
    return toVisionView(vision);
  }

  async updateVision(userId: string, id: string, dto: SaveVisionDto) {
    await this.findOwned('vision', userId, id);
    const vision = await this.prisma.visionPrescription.update({
      where: { id },
      data: this.visionData(dto),
    });
    return toVisionView(vision);
  }

  async createLens(userId: string, dto: SaveContactLensDto) {
    const lens = await this.prisma.contactLensCycle.create({
      data: { userId, ...this.lensData(dto) },
    });
    return toLensView(lens);
  }

  async updateLens(userId: string, id: string, dto: SaveContactLensDto) {
    await this.findOwned('lens', userId, id);
    const lens = await this.prisma.contactLensCycle.update({
      where: { id },
      data: this.lensData(dto),
    });
    return toLensView(lens);
  }

  async remove(model: MedicalModel, userId: string, id: string) {
    await this.findOwned(model, userId, id);
    const where = { id };
    if (model === 'appointment')
      await this.prisma.medicalAppointment.delete({ where });
    if (model === 'vaccine') await this.prisma.vaccine.delete({ where });
    if (model === 'exam') await this.prisma.medicalExam.delete({ where });
    if (model === 'illness') await this.prisma.illnessEpisode.delete({ where });
    if (model === 'vision')
      await this.prisma.visionPrescription.delete({ where });
    if (model === 'lens') await this.prisma.contactLensCycle.delete({ where });
    return { deleted: true };
  }

  private appointmentData(dto: SaveAppointmentDto) {
    return {
      at: new Date(dto.at),
      timeZone: dto.timeZone,
      specialty: dto.specialty,
      doctor: text(dto.doctor),
      place: text(dto.place),
      reason: text(dto.reason),
      notes: text(dto.notes),
      followUpDate: dateOnly(dto.followUpDate),
    };
  }

  private vaccineData(dto: SaveVaccineDto) {
    const date = dateOnly(dto.date)!;
    const nextDueDate = dateOnly(dto.nextDueDate);
    if (nextDueDate && nextDueDate <= date) {
      throw new BadRequestException({
        code: 'HEALTH_VACCINE_DATES',
        message: 'O próximo reforço tem de ser depois da data da vacina.',
      });
    }
    return {
      name: dto.name.trim(),
      date,
      dose: text(dto.dose),
      nextDueDate,
      notes: text(dto.notes),
    };
  }

  private examData(dto: SaveExamDto) {
    return {
      date: dateOnly(dto.date)!,
      kind: dto.kind,
      title: dto.title.trim(),
      bodyPart: text(dto.bodyPart),
      findings: text(dto.findings),
      summary: text(dto.summary),
    };
  }

  private illnessData(dto: SaveIllnessDto) {
    const startDate = dateOnly(dto.startDate)!;
    const endDate = dateOnly(dto.endDate);
    if (endDate && endDate < startDate) {
      throw new BadRequestException({
        code: 'HEALTH_ILLNESS_DATES',
        message: 'O fim é anterior ao início.',
      });
    }
    return {
      name: dto.name.trim(),
      startDate,
      endDate,
      symptoms: text(dto.symptoms),
      medication: text(dto.medication),
      notes: text(dto.notes),
    };
  }

  private visionData(dto: SaveVisionDto) {
    return {
      date: dateOnly(dto.date)!,
      kind: dto.kind,
      rightSphere: dto.rightSphere ?? null,
      rightCylinder: dto.rightCylinder ?? null,
      rightAxis: dto.rightAxis ?? null,
      leftSphere: dto.leftSphere ?? null,
      leftCylinder: dto.leftCylinder ?? null,
      leftAxis: dto.leftAxis ?? null,
      addition: dto.addition ?? null,
      pupillaryMm: dto.pupillaryMm ?? null,
      notes: text(dto.notes),
    };
  }

  private lensData(dto: SaveContactLensDto) {
    return {
      startDate: dateOnly(dto.startDate)!,
      replaceDays: dto.replaceDays,
      brand: text(dto.brand),
      notes: text(dto.notes),
    };
  }

  private checkPdf(file?: { buffer: Buffer; mimetype: string }) {
    if (!file?.buffer?.length || !/pdf/i.test(file.mimetype)) {
      throw new BadRequestException({
        code: 'HEALTH_EXAM_NOT_PDF',
        message: 'Escolhe um ficheiro PDF com o relatório do exame.',
      });
    }
  }

  private async findOwned(model: MedicalModel, userId: string, id: string) {
    const where = { id, userId };
    const select = { id: true };
    const found =
      model === 'appointment'
        ? await this.prisma.medicalAppointment.findFirst({ where, select })
        : model === 'vaccine'
          ? await this.prisma.vaccine.findFirst({ where, select })
          : model === 'exam'
            ? await this.prisma.medicalExam.findFirst({ where, select })
            : model === 'illness'
              ? await this.prisma.illnessEpisode.findFirst({ where, select })
              : model === 'vision'
                ? await this.prisma.visionPrescription.findFirst({
                    where,
                    select,
                  })
                : await this.prisma.contactLensCycle.findFirst({
                    where,
                    select,
                  });
    if (!found) throw new NotFoundException(NOT_FOUND[model]);
  }
}
