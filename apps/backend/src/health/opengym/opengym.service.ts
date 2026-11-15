import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OpenGymConnection, Prisma } from 'src/generated/prisma/client/client';
import { RUN_FREQUENCY_INTERVAL_MS } from '@myhomelab/shared';
import { PrismaService } from 'src/prisma/prisma.service';
import { decryptToken, encryptToken } from 'src/utils/crypto/token-cipher';
import { ExerciseService } from '../exercise.service';
import {
  OpenGymError,
  OpenGymState,
  openGymBaseUrl,
  openGymCatalogueExercise,
  openGymData,
  openGymMe,
  openGymRev,
  redeemOpenGymCode,
} from './openGymApi';
import {
  OpenGymExerciseInfo,
  WorkoutExerciseLog,
  openGymWorkoutData,
} from './openGymWorkoutData';
import { ConnectOpenGymDto, UpdateOpenGymDto } from './dto/opengym.dto';

const SOURCE_OPENGYM = 'OPENGYM';

/** Quantos exercícios do catálogo se pedem ao GitHub de cada vez. */
const CATALOGUE_BATCH = 6;

const json = (value: unknown) =>
  (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;

/** JSON com as chaves por ordem: o Postgres (jsonb) não guarda a ordem em que vieram. */
const stableJson = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        )
      : item,
  );

const toView = (
  connection: OpenGymConnection & {
    account?: { id: string; displayName: string | null } | null;
  },
  workouts: number,
) => ({
  connected: true,
  baseUrl: connection.baseUrl,
  // Pela app ligada (Apps ligadas → openGym), ou com um emparelhamento só da Saúde.
  accountId: connection.accountId,
  appName: connection.account?.displayName ?? null,
  accountName: connection.accountName,
  isActive: connection.isActive,
  runFrequency: connection.runFrequency,
  lastRunAt: connection.lastRunAt,
  lastSuccessAt: connection.lastSuccessAt,
  lastError: connection.lastError,
  lastCreated: connection.lastCreated,
  lastUpdated: connection.lastUpdated,
  lastDeleted: connection.lastDeleted,
  workouts,
});

export interface OpenGymSyncResult {
  unchanged: boolean;
  created: number;
  updated: number;
  deleted: number;
  linked: number;
  heart: number;
}

/**
 * A ligação ao openGym do utilizador: emparelha com o código da app, lê o
 * estado pela API (só leitura) e guarda os treinos como Workout de origem
 * OPENGYM, com os exercícios, as séries e as pausas. Cada treino novo ou
 * mudado cruza-se com o batimento importado e junta-se ao treino da Huawei que
 * se lhe sobrepõe.
 */
@Injectable()
export class OpenGymService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exercise: ExerciseService,
  ) {}

  async connection(userId: string) {
    const connection = await this.prisma.openGymConnection.findUnique({
      where: { userId },
      include: { account: { select: { id: true, displayName: true } } },
    });
    if (!connection) return { connected: false };
    return toView(connection, await this.countWorkouts(userId));
  }

  /**
   * Se o openGym responde agora, com a sessão guardada. Só lê a revisão dos
   * dados (um pedido pequeno), não sincroniza nada.
   */
  async status(userId: string) {
    const connection = await this.prisma.openGymConnection.findUnique({
      where: { userId },
    });
    if (!connection) return { online: false, error: null };
    try {
      const { baseUrl, token } = await this.credentials(connection);
      await openGymRev(baseUrl, token);
      return { online: true, error: null };
    } catch (error) {
      return {
        online: false,
        error: error instanceof OpenGymError ? error.message : String(error),
      };
    }
  }

  /** Emparelha com o código gerado no openGym e faz logo a primeira sincronização. */
  async connect(userId: string, dto: ConnectOpenGymDto) {
    const baseUrl = openGymBaseUrl(dto.baseUrl);
    let paired: Awaited<ReturnType<typeof redeemOpenGymCode>>;
    try {
      paired = await redeemOpenGymCode(baseUrl, dto.code);
    } catch (error) {
      throw this.badRequest(error);
    }
    const data = {
      baseUrl,
      token: encryptToken(paired.token),
      accountId: null,
      accountName: paired.user?.name ?? null,
      lastRev: null,
      lastError: null,
    };
    await this.prisma.openGymConnection.upsert({
      where: { userId },
      create: { ...data, userId },
      update: data,
    });
    const sync = await this.sync(userId, true);
    return { ...(await this.connection(userId)), sync };
  }

  /**
   * Lê os treinos pela app openGym já ligada (Apps ligadas): sem código nem token
   * próprio. Uma ligação só da Saúde que houvesse passa a usar a app.
   */
  async useApp(userId: string, accountId: string) {
    const account = await this.prisma.connectedAccount.findFirst({
      where: { id: accountId, userId, provider: 'OPENGYM', isActive: true },
    });
    if (!account?.baseUrl || !account.accessToken) {
      throw new NotFoundException(
        'Este openGym não está ligado em Apps ligadas.',
      );
    }
    const data = {
      baseUrl: account.baseUrl,
      token: null,
      accountId: account.id,
      accountName: account.displayName,
      lastRev: null,
      lastError: null,
    };
    await this.prisma.openGymConnection.upsert({
      where: { userId },
      create: { ...data, userId },
      update: data,
    });
    try {
      const sync = await this.sync(userId, true);
      return { ...(await this.connection(userId)), sync };
    } catch (error) {
      throw this.badRequest(error);
    }
  }

  /**
   * O endereço e o token a usar: os da app ligada (o token renovado vai para lá) ou
   * os do emparelhamento só da Saúde.
   */
  private async credentials(connection: OpenGymConnection) {
    if (connection.accountId) {
      const account = await this.prisma.connectedAccount.findUnique({
        where: { id: connection.accountId },
      });
      if (!account?.baseUrl || !account.accessToken) {
        throw new OpenGymError(
          'A app openGym ligada já não tem token: emparelha-a outra vez em Apps ligadas → openGym.',
        );
      }
      return {
        baseUrl: account.baseUrl,
        token: decryptToken(account.accessToken),
        save: async (token: string) => {
          await this.prisma.connectedAccount.update({
            where: { id: account.id },
            data: { accessToken: encryptToken(token) },
          });
        },
      };
    }
    if (!connection.token) {
      throw new OpenGymError('O openGym já não tem token: liga-o outra vez.');
    }
    return {
      baseUrl: connection.baseUrl,
      token: decryptToken(connection.token),
      save: async (token: string) => {
        await this.prisma.openGymConnection.update({
          where: { id: connection.id },
          data: { token: encryptToken(token) },
        });
      },
    };
  }

  async update(userId: string, dto: UpdateOpenGymDto) {
    await this.find(userId);
    await this.prisma.openGymConnection.update({
      where: { userId },
      data: {
        ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
        ...(dto.runFrequency ? { runFrequency: dto.runFrequency } : {}),
      },
    });
    return this.connection(userId);
  }

  /** Desliga: esquece o token. Os treinos importados ficam, salvo se se pedir para os apagar. */
  async disconnect(userId: string, removeWorkouts: boolean) {
    await this.find(userId);
    await this.prisma.openGymConnection.delete({ where: { userId } });
    const removed = removeWorkouts
      ? (
          await this.prisma.workout.deleteMany({
            where: { userId, source: SOURCE_OPENGYM },
          })
        ).count
      : 0;
    return { connected: false, removed };
  }

  /** "Sincronizar agora": lê tudo, mesmo que a revisão não tenha mudado. */
  async syncNow(userId: string) {
    try {
      const sync = await this.sync(userId, true);
      return { ...(await this.connection(userId)), sync };
    } catch (error) {
      throw this.badRequest(error);
    }
  }

  /** As ligações ativas cuja frequência já passou (para o scheduler). */
  async dueConnections() {
    const connections = await this.prisma.openGymConnection.findMany({
      where: { isActive: true },
      select: { userId: true, runFrequency: true, lastRunAt: true },
    });
    return connections.filter(
      (connection) =>
        !connection.lastRunAt ||
        Date.now() - connection.lastRunAt.getTime() >=
          RUN_FREQUENCY_INTERVAL_MS[connection.runFrequency],
    );
  }

  /**
   * Sincroniza: confirma o token (e guarda o renovado, se vier), vê a revisão
   * e, se mudou (ou com force), lê o estado e grava os treinos. Um erro fica
   * guardado na ligação para se mostrar e volta a ser lançado.
   */
  async sync(userId: string, force = false): Promise<OpenGymSyncResult> {
    const connection = await this.find(userId);
    try {
      const credentials = await this.credentials(connection);
      const { baseUrl } = credentials;
      let token = credentials.token;
      const me = await openGymMe(baseUrl, token);
      if (me.token) {
        token = me.token;
        await credentials.save(me.token);
      }

      const { rev } = await openGymRev(baseUrl, token);
      let result: OpenGymSyncResult = {
        unchanged: true,
        created: 0,
        updated: 0,
        deleted: 0,
        linked: 0,
        heart: 0,
      };
      if (
        force ||
        rev !== connection.lastRev ||
        (await this.hasUnnamedExercises(userId))
      ) {
        const data = await openGymData(baseUrl, token);
        result = await this.importState(userId, data.state);
      }

      await this.prisma.openGymConnection.update({
        where: { userId },
        data: {
          accountName: me.user?.name ?? connection.accountName,
          lastRev: rev,
          lastRunAt: new Date(),
          lastSuccessAt: new Date(),
          lastError: null,
          ...(result.unchanged
            ? {}
            : {
                lastCreated: result.created,
                lastUpdated: result.updated,
                lastDeleted: result.deleted,
              }),
        },
      });
      return result;
    } catch (error) {
      await this.prisma.openGymConnection.update({
        where: { userId },
        data: {
          lastRunAt: new Date(),
          lastError:
            error instanceof Error
              ? error.message
              : 'Falha a sincronizar com o openGym.',
        },
      });
      throw error;
    }
  }

  /**
   * Grava os treinos do estado: cria os novos, muda os que mudaram e apaga os
   * que já não estão no openGym. Os novos e os mudados voltam a cruzar-se com
   * o batimento; os novos juntam-se ao treino da Huawei da mesma hora.
   */
  private async importState(
    userId: string,
    state: OpenGymState,
  ): Promise<OpenGymSyncResult> {
    const workouts = Array.isArray(state.workouts)
      ? state.workouts.filter(
          (workout) => typeof workout?.id === 'string' && workout.id,
        )
      : null;
    if (!workouts) {
      throw new OpenGymError(
        'O openGym devolveu dados num formato que não conheço.',
      );
    }
    const names = await this.exerciseNames(state);

    const existing = await this.prisma.workout.findMany({
      where: { userId, source: SOURCE_OPENGYM },
    });
    const byExternalId = new Map(existing.map((row) => [row.externalId, row]));

    let created = 0;
    let updated = 0;
    const createdIds: string[] = [];
    const touched: string[] = [];
    for (const workout of workouts) {
      const data = openGymWorkoutData(workout, state.unit, names);
      const fields = { ...data, exercises: json(data.exercises) };
      const current = byExternalId.get(workout.id);
      if (!current) {
        const row = await this.prisma.workout.create({
          data: {
            ...fields,
            userId,
            source: SOURCE_OPENGYM,
            externalId: workout.id,
          },
        });
        created++;
        createdIds.push(row.id);
        touched.push(row.id);
        continue;
      }
      const changed =
        current.startAt.getTime() !== data.startAt.getTime() ||
        current.endAt.getTime() !== data.endAt.getTime() ||
        current.title !== data.title ||
        current.volumeKg !== data.volumeKg ||
        stableJson(current.exercises) !== stableJson(data.exercises);
      if (changed) {
        await this.prisma.workout.update({
          where: { id: current.id },
          data: fields,
        });
        updated++;
        touched.push(current.id);
      }
    }

    const keep = new Set(workouts.map((workout) => workout.id));
    const gone = existing.filter((row) => !keep.has(row.externalId));
    if (gone.length) {
      await this.prisma.workout.deleteMany({
        where: { id: { in: gone.map((row) => row.id) } },
      });
    }

    let heart = 0;
    for (const row of await this.prisma.workout.findMany({
      where: { id: { in: touched } },
    })) {
      if ((await this.exercise.syncWorkout(row)).heart) heart++;
    }
    const linked = createdIds.length
      ? await this.exercise.linkOpenGymWorkouts(userId, createdIds)
      : 0;

    return {
      unchanged: false,
      created,
      updated,
      deleted: gone.length,
      linked,
      heart,
    };
  }

  /**
   * O nome (e a parte do corpo, o músculo e o equipamento) de cada exercício
   * dos treinos: os criados pelo utilizador vêm do próprio estado; os do
   * catálogo, da cache e, os que faltam, do repositório do openGym.
   */
  private async exerciseNames(state: OpenGymState) {
    const names = new Map<string, OpenGymExerciseInfo>();
    for (const custom of state.customEx ?? []) {
      if (custom?.id && custom.n) {
        names.set(custom.id, {
          name: custom.n,
          bodyPart: custom.bp ?? null,
          target: null,
          equipment: null,
        });
      }
    }
    const ids = [
      ...new Set(
        (state.workouts ?? []).flatMap((workout) =>
          (workout.entries ?? []).map((entry) => entry.id),
        ),
      ),
    ].filter((id) => typeof id === 'string' && !names.has(id));

    const cached = await this.prisma.openGymExercise.findMany({
      where: { id: { in: ids } },
    });
    for (const exercise of cached) names.set(exercise.id, exercise);

    const missing = ids.filter((id) => !names.has(id));
    for (let index = 0; index < missing.length; index += CATALOGUE_BATCH) {
      const found = await Promise.all(
        missing
          .slice(index, index + CATALOGUE_BATCH)
          .map((id) => openGymCatalogueExercise(id)),
      );
      for (const exercise of found) {
        if (!exercise) continue;
        names.set(exercise.id, exercise);
        await this.prisma.openGymExercise.upsert({
          where: { id: exercise.id },
          create: exercise,
          update: exercise,
        });
      }
    }
    return names;
  }

  /** Algum exercício ficou sem nome (o catálogo não respondeu): vale a pena ler outra vez. */
  private async hasUnnamedExercises(userId: string) {
    const rows = await this.prisma.workout.findMany({
      where: { userId, source: SOURCE_OPENGYM },
      select: { exercises: true },
    });
    return rows.some(
      (row) =>
        Array.isArray(row.exercises) &&
        (row.exercises as unknown as WorkoutExerciseLog[]).some(
          (exercise) => !exercise.name,
        ),
    );
  }

  private countWorkouts(userId: string) {
    return this.prisma.workout.count({
      where: { userId, source: SOURCE_OPENGYM },
    });
  }

  private async find(userId: string) {
    const connection = await this.prisma.openGymConnection.findUnique({
      where: { userId },
    });
    if (!connection) throw new NotFoundException('O openGym não está ligado.');
    return connection;
  }

  private badRequest(error: unknown) {
    if (error instanceof OpenGymError) {
      return new BadRequestException({
        code: 'OPENGYM_SYNC',
        message: error.message,
      });
    }
    return error;
  }
}
