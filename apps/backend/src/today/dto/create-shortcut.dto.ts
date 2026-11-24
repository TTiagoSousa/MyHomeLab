import {
  IsEnum,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { TodayShortcutKind } from 'src/generated/prisma/client/client';

export class CreateShortcutDto {
  @IsEnum(TodayShortcutKind)
  kind: TodayShortcutKind;

  @ValidateIf((dto: CreateShortcutDto) => dto.kind === TodayShortcutKind.APP)
  @IsUUID()
  accountId?: string;

  @ValidateIf(
    (dto: CreateShortcutDto) => dto.kind === TodayShortcutKind.HEALTH_FORM,
  )
  @IsUUID()
  formId?: string;

  @ValidateIf((dto: CreateShortcutDto) => dto.kind === TodayShortcutKind.LINK)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  label?: string;

  @ValidateIf((dto: CreateShortcutDto) => dto.kind === TodayShortcutKind.LINK)
  @IsString()
  @MaxLength(500)
  @Matches(/^https?:\/\/\S+$/i, {
    message: 'O endereço tem de começar por http:// ou https://.',
  })
  url?: string;
}
