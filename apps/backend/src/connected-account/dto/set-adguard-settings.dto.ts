import { IsIn, IsInt } from 'class-validator';
import { ADGUARD_FILTER_INTERVALS } from 'src/adguard/adguard.client';

/** As definições manuais do AdGuard: de quantas em quantas horas se descarregam as listas (0 = nunca). */
export class SetAdguardSettingsDto {
  @IsInt()
  @IsIn([...ADGUARD_FILTER_INTERVALS])
  filtersInterval: number;
}
