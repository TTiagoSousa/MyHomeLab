import { IsIn, IsInt } from 'class-validator';
import { CRON_INTERVALS } from '../cron-job.registry';

export class SaveCronJobDto {
  /** De quantos em quantos minutos (0 = desligada). */
  @IsInt()
  @IsIn([...CRON_INTERVALS])
  intervalMinutes!: number;
}
