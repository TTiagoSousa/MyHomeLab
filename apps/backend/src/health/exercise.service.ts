import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, Workout } from 'src/generated/prisma/client/client';
import {
  HuaweiWorkoutsPayload,
  parseHuaweiWorkouts,
} from './huawei/parseHuaweiWorkouts';
import { exerciseAverages } from './helpers/exerciseAverages';
import { workoutContext, workoutDays } from './helpers/workoutContext';
import { manualWorkoutData } from './helpers/manualWorkoutData';
import { exerciseTotals } from './helpers/exerciseTotals';
import { SaveManualWorkoutDto } from './dto/save-manual-workout.dto';
import { randomUUID } from 'crypto';
import { workoutHeartRate } from './helpers/workoutHeartRate';
import { estimateWorkoutCalories } from './helpers/estimateWorkoutCalories';
import { ageOn } from './helpers/ageOn';
import { mergeWorkoutParts } from './helpers/mergeWorkoutParts';
import { SetWorkoutPartsDto } from './dto/set-workout-parts.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const SOURCE_HUAWEI = 'HUAWEI';
const SOURCE_MANUAL = 'MANUAL';
const SOURCE_OPENGYM = 'OPENGYM';
const OTHER_TYPE = 'other';

/** Só se juntam numa sessão treinos que começam até 12 h antes ou depois do principal. */
const PART_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Os treinos que se cruzam com o batimento importado (os da Huawei já o trazem). */
const HEART_SOURCES = [SOURCE_MANUAL, SOURCE_OPENGYM];

/** Um treino do openGym junta-se ao da Huawei quando se sobrepõem em pelo menos metade. */
const MIN_OVERLAP = 0.5;

const dayOf = (entry: { day: Date }) => entry.day.toISOString().slice(0, 10);

/** Um treino para a tabela: sem as séries nem os exercícios, que só fazem falta ao abrir o treino. */
const toListView = (workout: Workout) => {
  const {
    heartRate, // eslint-disable-line @typescript-eslint/no-unused-vars
    cadence, // eslint-disable-line @typescript-eslint/no-unused-vars
    altitude, // eslint-disable-line @typescript-eslint/no-unused-vars
    route,
    splits, // eslint-disable-line @typescript-eslint/no-unused-vars
    userId, // eslint-disable-line @typescript-eslint/no-unused-vars
    exercises,
    ...rest
  } = workout;
  return {
    ...rest,
    day: dayOf(workout),
    hasRoute: route != null,
    exerciseCount: Array.isArray(exercises) ? exercises.length : 0,
  };
};

const json = (value: unknown) =>
  (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;

/**
 * Os treinos do utilizador. Os períodos contam a partir do último treino
 * importado, como nas outras métricas; os passos do dia a dia são do
 * StepsService.
 */
@Injectable()
export class ExerciseService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recebe o ficheiro que o browser montou com os treinos da pasta "Motion
   * path detail data" (resumo, séries e rota GPS) e grava um registo por treino, pelo
   * recordId da Huawei. Importar outra vez atualiza os que já existem.
   */
  async importHuawei(userId: string, file?: { buffer: Buffer }) {
    let payload: HuaweiWorkoutsPayload;
    try {
      payload = JSON.parse(
        file?.buffer.toString('utf8') ?? '',
      ) as HuaweiWorkoutsPayload;
    } catch {
      throw new BadRequestException({
        code: 'HEALTH_NO_EXERCISE',
        message: 'O ficheiro dos treinos não é válido.',
      });
    }

    const workouts = parseHuaweiWorkouts(payload);
    if (!workouts.length) {
      throw new BadRequestException({
        code: 'HEALTH_NO_EXERCISE',
        message:
          'Não encontrei treinos. Confirma que escolheste a pasta do export da Huawei (com a pasta "Motion path detail data").',
      });
    }

    // Cada código da Huawei cai no tipo do catálogo que o inclui; os que
    // nenhum tipo conhece ficam em "other".
    const sports = await this.prisma.exerciseType.findMany({
      where: { category: 'SPORT' },
    });
    const typeOfCode = new Map(
      sports.flatMap((type) => type.huaweiCodes.map((code) => [code, type.id])),
    );

    let created = 0;
    for (const workout of workouts) {
      const data = {
        ...workout,
        typeId: typeOfCode.get(workout.sportType) ?? OTHER_TYPE,
        day: new Date(`${workout.day}T00:00:00Z`),
        heartZones: json(workout.heartZones),
        heartRate: json(workout.heartRate),
        cadence: json(workout.cadence),
        altitude: json(workout.altitude),
        route: json(workout.route),
        splits: json(workout.splits),
      };
      const existing = await this.prisma.workout.findUnique({
        where: {
          userId_source_externalId: {
            userId,
            source: SOURCE_HUAWEI,
            externalId: workout.externalId,
          },
        },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.workout.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.workout.create({
          data: { ...data, userId, source: SOURCE_HUAWEI },
        });
        created++;
      }
    }
    await this.linkOpenGymWorkouts(userId);

    return {
      workouts: workouts.length,
      created,
      updated: workouts.length - created,
      from: workouts[0].day,
      to: workouts[workouts.length - 1].day,
    };
  }

  /** Os tipos de treino (desportos), pela ordem das listas; a interface traduz pelo id. */
  types() {
    return this.prisma.exerciseType.findMany({ orderBy: { position: 'asc' } });
  }

  /**
   * Um treino registado à mão: o tipo, as horas, as calorias e as notas. A
   * seguir cruza-se logo com o batimento importado.
   */
  async createManual(userId: string, dto: SaveManualWorkoutDto) {
    const workout = manualWorkoutData(
      dto,
      await this.prisma.exerciseType.findMany(),
    );
    const created = await this.prisma.workout.create({
      data: {
        ...workout,
        userId,
        source: SOURCE_MANUAL,
        externalId: randomUUID(),
      },
    });
    const sync = await this.syncWorkout(created);
    return { id: created.id, sync };
  }

  /** Muda um treino manual. */
  async updateManual(userId: string, id: string, dto: SaveManualWorkoutDto) {
    await this.findManual(userId, id);
    const updated = await this.prisma.workout.update({
      where: { id },
      data: manualWorkoutData(dto, await this.prisma.exerciseType.findMany()),
    });
    const sync = await this.syncWorkout(updated);
    return { id, sync };
  }

  /** Volta a cruzar um treino manual ou do openGym com o batimento importado. */
  async syncManual(userId: string, id: string) {
    return this.syncWorkout(await this.findWorkout(userId, id));
  }

  /**
   * Volta a cruzar todos os treinos manuais e do openGym com o batimento
   * importado (ex: depois de importar o batimento da Huawei, que pode ter
   * chegado depois do treino).
   */
  async syncAllHeartRate(userId: string) {
    const workouts = await this.prisma.workout.findMany({
      where: { userId, source: { in: HEART_SOURCES }, durationSec: { gt: 0 } },
    });
    let heart = 0;
    let calories = 0;
    for (const workout of workouts) {
      const result = await this.syncWorkout(workout);
      if (result.heart) heart++;
      if (result.calories) calories++;
    }
    return { checked: workouts.length, heart, calories };
  }

  /**
   * Junta ao treino (manual ou do openGym) o batimento que o relógio mediu
   * nesse intervalo (série, média, mínimo, máximo e zonas) e, se não se
   * indicaram calorias, estima-as pelo batimento, idade, sexo e peso. Sem
   * duração não há intervalo para cruzar.
   */
  async syncWorkout(workout: Workout) {
    if (!HEART_SOURCES.includes(workout.source) || workout.durationSec <= 0) {
      return { heart: false, calories: false };
    }
    const heartDays = await this.prisma.heartRateDay.findMany({
      where: { userId: workout.userId, day: { in: workoutDays(workout) } },
      select: { day: true, points: true },
    });
    const heart = workoutHeartRate(workout, heartDays);

    let calories = workout.caloriesEstimated ? null : workout.calories;
    let caloriesEstimated = false;
    if (calories == null && heart) {
      calories = await this.estimateCalories(workout, heart.avg);
      caloriesEstimated = calories != null;
    }

    await this.prisma.workout.update({
      where: { id: workout.id },
      data: {
        heartRate: json(heart?.heartRate),
        heartZones: json(heart?.zones),
        avgHeartRate: heart?.avg ?? null,
        minHeartRate: heart?.min ?? null,
        maxHeartRate: heart?.max ?? null,
        calories,
        caloriesEstimated,
        syncedAt: new Date(),
      },
    });
    return { heart: Boolean(heart), calories: caloriesEstimated };
  }

  /**
   * Junta cada treino do openGym ainda solto ao treino da Huawei que se lhe
   * sobrepõe (o relógio gravou a mesma sessão): o da Huawei fica o principal e
   * o do openGym uma parte, e a sessão mostra o batimento com os exercícios.
   */
  async linkOpenGymWorkouts(userId: string, ids?: string[]) {
    const openGym = await this.prisma.workout.findMany({
      where: {
        userId,
        source: SOURCE_OPENGYM,
        parentId: null,
        parts: { none: {} },
        ...(ids ? { id: { in: ids } } : {}),
      },
    });
    let linked = 0;
    for (const workout of openGym) {
      const candidates = await this.prisma.workout.findMany({
        where: {
          userId,
          source: SOURCE_HUAWEI,
          parentId: null,
          startAt: { lt: workout.endAt },
          endAt: { gt: workout.startAt },
        },
      });
      const shorter = (other: Workout) =>
        Math.min(
          workout.endAt.getTime() - workout.startAt.getTime(),
          other.endAt.getTime() - other.startAt.getTime(),
        );
      const overlap = (other: Workout) =>
        Math.min(workout.endAt.getTime(), other.endAt.getTime()) -
        Math.max(workout.startAt.getTime(), other.startAt.getTime());
      const main = candidates
        .filter((other) => overlap(other) >= shorter(other) * MIN_OVERLAP)
        .sort((a, b) => overlap(b) - overlap(a))[0];
      if (!main) continue;
      await this.prisma.workout.update({
        where: { id: workout.id },
        data: { parentId: main.id, partRole: 'PART' },
      });
      linked++;
    }
    return linked;
  }

  private async estimateCalories(workout: Workout, avgBpm: number) {
    const [profile, weight] = await Promise.all([
      this.prisma.healthProfile.findUnique({
        where: { userId: workout.userId },
        select: { birthDate: true, sex: true },
      }),
      this.prisma.weightEntry.findFirst({
        where: { userId: workout.userId },
        orderBy: { measuredAt: 'desc' },
        select: { weightKg: true },
      }),
    ]);
    return estimateWorkoutCalories({
      avgBpm,
      minutes: workout.durationSec / 60,
      age: profile?.birthDate ? ageOn(profile.birthDate, dayOf(workout)) : null,
      sex: profile?.sex ?? null,
      weightKg: weight?.weightKg ?? null,
    });
  }

  /** Apaga um treino manual. Os da Huawei não se apagam: voltavam na importação seguinte. */
  async deleteManual(userId: string, id: string) {
    await this.findManual(userId, id);
    await this.prisma.workout.delete({ where: { id } });
    return { deleted: true };
  }

  /** Para o cartão de médias da página Saúde: últimos 7, 30 e 90 dias. */
  async summary(userId: string) {
    const latest = await this.latestDay(userId);
    if (!latest) return null;

    const last90 = await this.workoutsSince(userId, latest, 90);
    const within = (days: number) =>
      last90.filter(
        (entry) => entry.day.getTime() > latest.getTime() - days * DAY_MS,
      );
    return {
      latestDay: dayOf({ day: latest }),
      last7: exerciseAverages(within(7), 7),
      last30: exerciseAverages(within(30), 30),
      last90: exerciseAverages(last90, 90),
    };
  }

  /** O dashboard: médias do período e os treinos (sem as séries). */
  async exercise(userId: string, days: number) {
    const latest = await this.latestDay(userId);
    if (!latest) return { averages: null, workouts: [] };

    const workouts =
      days > 0
        ? await this.workoutsSince(userId, latest, days)
        : await this.prisma.workout.findMany({ where: { userId } });
    workouts.sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
    return {
      averages: exerciseAverages(workouts, days),
      moves: exerciseTotals(workouts),
      workouts: workouts.map(toListView),
    };
  }

  /** Os treinos do openGym num período (a contar de hoje), com os exercícios e as séries. */
  gymWorkouts(userId: string, days: number) {
    return this.prisma.workout.findMany({
      where: {
        userId,
        source: SOURCE_OPENGYM,
        ...(days > 0
          ? { startAt: { gte: new Date(Date.now() - days * DAY_MS) } }
          : {}),
      },
      orderBy: { startAt: 'desc' },
    });
  }

  /**
   * Os treinos que se podem juntar a este numa sessão (aquecimento, retorno à
   * calma ou parte): até 12 h antes ou depois e que não sejam já o principal
   * de outra sessão. Os que já estão ligados vêm com o parentId.
   */
  async partCandidates(userId: string, id: string) {
    const main = await this.findWorkout(userId, id);
    this.assertCanBeMain(main);
    const candidates = await this.prisma.workout.findMany({
      where: {
        userId,
        id: { not: id },
        startAt: {
          gte: new Date(main.startAt.getTime() - PART_WINDOW_MS),
          lte: new Date(main.startAt.getTime() + PART_WINDOW_MS),
        },
        parts: { none: {} },
      },
      orderBy: { startAt: 'asc' },
    });
    return candidates.map(toListView);
  }

  /**
   * Define a sessão de um treino principal: os treinos que vêm ficam ligados a
   * ele com o papel indicado e os que lá estavam e não vêm ficam soltos.
   */
  async setParts(userId: string, id: string, dto: SetWorkoutPartsDto) {
    const main = await this.findWorkout(userId, id);
    this.assertCanBeMain(main);
    const ids = [...new Set(dto.parts.map((part) => part.id))];
    if (ids.includes(id)) {
      throw new BadRequestException({
        code: 'HEALTH_WORKOUT_PART_SELF',
        message: 'Um treino não pode ser parte de si próprio.',
      });
    }
    const parts = await this.prisma.workout.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true, startAt: true, _count: { select: { parts: true } } },
    });
    if (parts.length !== ids.length) {
      throw new NotFoundException('Treino não encontrado');
    }
    if (parts.some((part) => part._count.parts > 0)) {
      throw new BadRequestException({
        code: 'HEALTH_WORKOUT_HAS_PARTS',
        message:
          'Esse treino já é o principal de outra sessão; separa-a primeiro.',
      });
    }
    if (
      parts.some(
        (part) =>
          Math.abs(part.startAt.getTime() - main.startAt.getTime()) >
          PART_WINDOW_MS,
      )
    ) {
      throw new BadRequestException({
        code: 'HEALTH_WORKOUT_PART_FAR',
        message:
          'Só se juntam treinos que começam até 12 horas antes ou depois do principal.',
      });
    }
    const roleOf = new Map(dto.parts.map((part) => [part.id, part.role]));
    await this.prisma.$transaction([
      this.prisma.workout.updateMany({
        where: { parentId: id, id: { notIn: ids } },
        data: { parentId: null, partRole: null },
      }),
      ...ids.map((partId) =>
        this.prisma.workout.update({
          where: { id: partId },
          data: { parentId: id, partRole: roleOf.get(partId)! },
        }),
      ),
    ]);
    return this.workout(userId, id);
  }

  /** Tira um treino da sessão em que está (volta a ser um treino solto). */
  async detachPart(userId: string, id: string) {
    await this.findWorkout(userId, id);
    await this.prisma.workout.update({
      where: { id },
      data: { parentId: null, partRole: null },
    });
    return { detached: true };
  }

  /**
   * Um treino com as séries, a rota e os tempos por km, e o que as outras
   * métricas mediram durante ele (temperatura da pele, oxigénio, stress e o
   * repouso desse dia). Se for o principal de uma sessão vem com as partes e
   * os totais da sessão; se for uma parte, com o principal.
   */
  async workout(userId: string, id: string) {
    const workout = await this.prisma.workout.findFirst({
      where: { id, userId },
      include: {
        parts: { orderBy: { startAt: 'asc' } },
        parent: {
          select: { id: true, typeId: true, startAt: true, day: true },
        },
      },
    });
    if (!workout) throw new NotFoundException('Treino não encontrado');
    const { parts, parent } = workout;
    const session = parts.length
      ? mergeWorkoutParts([workout, ...parts])[0]
      : null;

    const where = { userId, day: { in: workoutDays(workout) } };
    const [heart, skin, oxygen, stress] = await Promise.all([
      this.prisma.heartRateDay.findMany({ where }),
      this.prisma.skinTemperatureDay.findMany({ where }),
      this.prisma.bloodOxygenDay.findMany({ where }),
      this.prisma.stressDay.findMany({ where }),
    ]);

    return {
      ...toListView(workout),
      heartRate: workout.heartRate,
      cadence: workout.cadence,
      altitude: workout.altitude,
      route: workout.route,
      splits: workout.splits,
      exercises: workout.exercises ?? [],
      partExercises: parts
        .filter((part) => Array.isArray(part.exercises))
        .map((part) => ({
          id: part.id,
          title: part.title,
          exercises: part.exercises,
        })),
      context: workoutContext(workout, { heart, skin, oxygen, stress }),
      parent: parent ? { ...parent, day: dayOf(parent) } : null,
      parts: parts.map(toListView),
      session: session && {
        startAt: session.startAt,
        endAt: session.endAt,
        durationSec: session.durationSec,
        distanceM: session.distanceM,
        calories: session.calories,
        avgHeartRate: session.avgHeartRate,
        maxHeartRate: session.maxHeartRate,
      },
    };
  }

  private async findWorkout(userId: string, id: string) {
    const workout = await this.prisma.workout.findFirst({
      where: { id, userId },
    });
    if (!workout) throw new NotFoundException('Treino não encontrado');
    return workout;
  }

  private assertCanBeMain(workout: Workout) {
    if (workout.parentId) {
      throw new BadRequestException({
        code: 'HEALTH_WORKOUT_IS_PART',
        message:
          'Este treino já é parte de outra sessão; abre o principal ou separa-o primeiro.',
      });
    }
  }

  private async findManual(userId: string, id: string) {
    const workout = await this.prisma.workout.findFirst({
      where: { id, userId },
      select: { source: true },
    });
    if (!workout) throw new NotFoundException('Treino não encontrado');
    if (workout.source !== SOURCE_MANUAL) {
      throw new BadRequestException({
        code: 'HEALTH_WORKOUT_NOT_MANUAL',
        message:
          'Só os treinos registados à mão se podem mudar ou apagar; os do relógio e do openGym vêm de lá.',
      });
    }
  }

  private async latestDay(userId: string) {
    const latest = await this.prisma.workout.findFirst({
      where: { userId },
      orderBy: { day: 'desc' },
      select: { day: true },
    });
    return latest?.day ?? null;
  }

  private workoutsSince(userId: string, latest: Date, days: number) {
    return this.prisma.workout.findMany({
      where: {
        userId,
        day: { gt: new Date(latest.getTime() - days * DAY_MS) },
      },
    });
  }
}
