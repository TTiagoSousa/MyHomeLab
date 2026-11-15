import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsUUID,
  ValidateNested,
} from 'class-validator';

/** Aquecimento, retorno à calma ou parte do mesmo treino. */
export const WORKOUT_PART_ROLES = ['WARMUP', 'COOLDOWN', 'PART'] as const;

export class WorkoutPartDto {
  @IsUUID()
  id!: string;

  @IsIn([...WORKOUT_PART_ROLES])
  role!: string;
}

/** Os treinos ligados ao principal; os que lá estavam e não vêm ficam soltos. */
export class SetWorkoutPartsDto {
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => WorkoutPartDto)
  parts!: WorkoutPartDto[];
}
