import { BadRequestException } from '@nestjs/common';
import { ExerciseType } from 'src/generated/prisma/client/client';
import { SaveManualWorkoutDto } from '../dto/save-manual-workout.dto';
import { localDay } from './timeZone';

/**
 * Converte o formulário de um treino manual nos campos do Workout e confirma
 * que o tipo do treino é um desporto. A duração vem do fim (se vier) ou dos
 * minutos indicados.
 */
export function manualWorkoutData(
  dto: SaveManualWorkoutDto,
  catalog: ExerciseType[],
) {
  const byId = new Map(catalog.map((type) => [type.id, type]));
  if (byId.get(dto.typeId)?.category !== 'SPORT') {
    throw new BadRequestException({
      code: 'HEALTH_WORKOUT_TYPE',
      message: 'O tipo de treino não existe.',
    });
  }
  const startAt = new Date(dto.startAt);
  const endAt = dto.endAt ? new Date(dto.endAt) : null;
  if (endAt && endAt.getTime() <= startAt.getTime()) {
    throw new BadRequestException({
      code: 'HEALTH_WORKOUT_END',
      message: 'A hora de fim tem de ser depois da hora de início.',
    });
  }
  const durationSec = endAt
    ? Math.round((endAt.getTime() - startAt.getTime()) / 1000)
    : (dto.durationMin ?? 0) * 60;
  if (durationSec > 24 * 3600) {
    throw new BadRequestException({
      code: 'HEALTH_WORKOUT_END',
      message: 'Um treino não pode durar mais de 24 horas.',
    });
  }

  if (!durationSec) {
    throw new BadRequestException({
      code: 'HEALTH_WORKOUT_EMPTY',
      message: 'Indica a duração do treino.',
    });
  }

  return {
    typeId: dto.typeId,
    sportType: null,
    notes: dto.notes?.trim() || null,
    day: new Date(`${localDay(startAt, dto.timeZone)}T00:00:00Z`),
    timeZone: dto.timeZone,
    startAt,
    endAt: new Date(startAt.getTime() + durationSec * 1000),
    durationSec,
    calories: dto.calories ?? null,
    caloriesEstimated: false,
    difficulty: dto.difficulty ?? null,
  };
}
