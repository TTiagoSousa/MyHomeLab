import { IsISO8601, IsNumber, Matches, Max, Min } from 'class-validator';

export class SaveWeightDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(20)
  @Max(400)
  weightKg!: number;

  /** Quando se pesou, como instante ISO (UTC). */
  @IsISO8601()
  measuredAt!: string;

  /** O fuso do browser no formato da Huawei ("+0100"), para o dia local. */
  @Matches(/^[+-]\d{4}$/)
  timeZone!: string;
}
