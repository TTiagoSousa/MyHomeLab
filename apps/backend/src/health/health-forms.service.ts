import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  SaveHealthFormDto,
  SubmitHealthFormDto,
} from './dto/save-health-form.dto';
import { WeightService } from './weight.service';
import { BodyService } from './body.service';
import { WaterService } from './water.service';
import { checkedValues } from './helpers/checkedValues';
import { localDayDate } from './helpers/localDayDate';
import {
  BODY_FIELDS,
  COMPOSITION_FIELDS,
  HEALTH_FORM_FIELDS,
  type HealthFormField,
} from './helpers/healthMetrics';

const WEIGHING_FIELDS = ['weightKg', ...COMPOSITION_FIELDS] as const;

const FORM_SELECT = { id: true, name: true, fields: true } as const;

/** Os campos pela ordem do catálogo (e sem repetidos). */
const ordered = (fields: string[]) =>
  HEALTH_FORM_FIELDS.filter((field) => fields.includes(field));

/**
 * Os formulários rápidos da Saúde: cada um junta campos de vários sítios (peso e
 * composição, medidas do Corpo, água) para se meterem de uma só vez.
 */
@Injectable()
export class HealthFormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weight: WeightService,
    private readonly body: BodyService,
    private readonly water: WaterService,
  ) {}

  list(userId: string) {
    return this.prisma.healthForm.findMany({
      where: { userId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: FORM_SELECT,
    });
  }

  async create(userId: string, dto: SaveHealthFormDto) {
    const last = await this.prisma.healthForm.findFirst({
      where: { userId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return this.prisma.healthForm.create({
      data: {
        userId,
        name: dto.name.trim(),
        fields: ordered(dto.fields),
        position: (last?.position ?? -1) + 1,
      },
      select: FORM_SELECT,
    });
  }

  async update(userId: string, id: string, dto: SaveHealthFormDto) {
    await this.find(userId, id);
    return this.prisma.healthForm.update({
      where: { id },
      data: { name: dto.name.trim(), fields: ordered(dto.fields) },
      select: FORM_SELECT,
    });
  }

  /** Os atalhos do Hoje para este formulário vão com ele. */
  async remove(userId: string, id: string) {
    await this.find(userId, id);
    await this.prisma.healthForm.delete({ where: { id } });
  }

  /**
   * Guarda o que se meteu: as medidas da balança numa pesagem, as de fita no
   * Corpo desse dia (sem apagar as outras) e a água num registo. Tudo é
   * verificado antes de se gravar alguma coisa.
   */
  async submit(userId: string, id: string, dto: SubmitHealthFormDto) {
    const form = await this.find(userId, id);
    const allowed = form.fields as HealthFormField[];
    const input = Object.fromEntries(
      allowed.map((field) => [field, dto.values[field]]),
    ) as Partial<Record<HealthFormField, number | null>>;

    const weighing = checkedValues(
      WEIGHING_FIELDS.filter((field) => allowed.includes(field)),
      input,
    );
    const body = checkedValues(
      BODY_FIELDS.filter((field) => allowed.includes(field)),
      input,
    );
    const water = checkedValues(
      allowed.includes('waterMl') ? (['waterMl'] as const) : [],
      input,
    );
    if (
      !Object.keys(weighing).length &&
      !Object.keys(body).length &&
      water.waterMl == null
    ) {
      throw new BadRequestException({
        code: 'HEALTH_FORM_EMPTY',
        message: 'Mete pelo menos um valor.',
      });
    }

    if (Object.keys(weighing).length) {
      await this.weight.create(userId, {
        ...weighing,
        deviceId: dto.deviceId,
        measuredAt: dto.measuredAt,
        timeZone: dto.timeZone,
      });
    }
    if (Object.keys(body).length) {
      const day = localDayDate(new Date(dto.measuredAt), dto.timeZone);
      await this.body.mergeMeasurement(userId, day, body);
    }
    if (water.waterMl != null) {
      await this.water.create(userId, {
        ml: Math.round(water.waterMl),
        drankAt: dto.measuredAt,
        timeZone: dto.timeZone,
      });
    }
    return { saved: true };
  }

  private async find(userId: string, id: string) {
    const form = await this.prisma.healthForm.findFirst({
      where: { id, userId },
      select: FORM_SELECT,
    });
    if (!form) throw new NotFoundException('Formulário não encontrado');
    return form;
  }
}
