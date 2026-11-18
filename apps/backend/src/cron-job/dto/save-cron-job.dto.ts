import { IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

export class SaveCronJobDto {
  /** De quantos em quantos minutos (0 = desligada); o registo diz os que a tarefa aceita. */
  @IsInt()
  @Min(0)
  @Max(10080)
  intervalMinutes!: number;

  /** As opções da tarefa (ex.: o limite do aviso de disco), validadas pelo registo. */
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;
}
