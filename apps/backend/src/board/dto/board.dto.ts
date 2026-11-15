import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  BoardStateGroup,
  TaskPriority,
  TaskRelationKind,
} from 'src/generated/prisma/client/client';

export class SaveProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6)
  identifier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  agentKeys?: string[];

  @IsOptional()
  @IsInt()
  color?: number;

  /** O servidor das atualizações (só no projeto das atualizações); null tira-o. */
  @IsOptional()
  @IsString()
  serverConnectionId?: string | null;
}

export class SaveStateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsEnum(BoardStateGroup)
  group?: BoardStateGroup;

  @IsOptional()
  @Matches(/^#[0-9a-f]{6}$/i)
  color?: string;

  @IsOptional()
  @IsInt()
  position?: number;

  /** A divisão da coluna no quadro; vazio tira-a. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phase?: string;
}

export class SaveModuleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}

export class SaveTaskDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(250)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  description?: string;

  @IsOptional()
  @IsUUID()
  stateId?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(60)
  assignee?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  labels?: string[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  startDate?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  dueDate?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  moduleIds?: string[];

  @IsOptional()
  @IsNumber()
  position?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  cycleId?: string | null;
}

export class BulkTasksDto extends SaveTaskDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  ids!: string[];
}

export class SaveCycleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;
}

export class RelationDto {
  /** A outra tarefa: a chave (ATU-12) ou o id. */
  @IsString()
  @MaxLength(60)
  task!: string;

  @IsEnum(TaskRelationKind)
  kind!: TaskRelationKind;
}

export class ListTasksQueryDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  stateId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  assignee?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  label?: string;

  @IsOptional()
  @IsUUID()
  moduleId?: string;

  @IsOptional()
  @IsUUID()
  cycleId?: string;

  /** "true": só as que não estão feitas nem canceladas. */
  @IsOptional()
  @IsIn(['true', 'false'])
  open?: string;
}

export class CommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  body!: string;
}

export class LinkDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsString()
  @MaxLength(2000)
  url!: string;
}

export class LinkDocDto {
  @IsUUID()
  docId!: string;
}
