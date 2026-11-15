import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TodoSyncScope } from 'src/generated/prisma/client/client';

export class TodoSyncSettingDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** De quantos em quantos minutos (um de SYNC_INTERVALS). */
  @IsOptional()
  @IsInt()
  intervalMinutes?: number;
}

/** Um grupo: o nome, os emails e o que sincroniza (tudo ou só estas listas). */
export class SaveTodoSyncGroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsEnum(TodoSyncScope)
  scope!: TodoSyncScope;

  /** Se as Tarefas do servidor entram; sem elas, sincroniza só entre os emails. */
  @IsBoolean()
  includeLocal!: boolean;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  listNames!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  accountIds!: string[];
}
