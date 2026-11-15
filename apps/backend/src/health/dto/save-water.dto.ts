import { IsISO8601, IsInt, Matches, Max, Min } from 'class-validator';

export class SaveWaterDto {
  @IsInt()
  @Min(1)
  @Max(5000)
  ml!: number;

  /** Quando se bebeu, como instante ISO (UTC). */
  @IsISO8601()
  drankAt!: string;

  /** O fuso do browser no formato da Huawei ("+0100"), para o dia local. */
  @Matches(/^[+-]\d{4}$/)
  timeZone!: string;
}
