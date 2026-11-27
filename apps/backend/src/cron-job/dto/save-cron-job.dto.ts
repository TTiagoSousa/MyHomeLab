import {
  IsInt,
  IsObject,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class SaveCronJobDto {
  /** De quantos em quantos minutos (0 = desligada); o registo diz os que a tarefa aceita. */
  @IsInt()
  @Min(0)
  @Max(10080)
  intervalMinutes!: number;

  /** Todos os dias: a hora de Lisboa ("HH:mm"); null = 24 h depois da última vez. */
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'A hora tem de ser HH:mm.' })
  time?: string | null;

  /** As opções da tarefa (ex.: o limite do aviso de disco), validadas pelo registo. */
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}
