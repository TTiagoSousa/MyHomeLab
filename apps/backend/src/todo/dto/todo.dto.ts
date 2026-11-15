import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TodoPriority, TodoStatus } from 'src/generated/prisma/client/client';

export class CreateTodoListDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string | null;
}

export class UpdateTodoListDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string | null;

  @IsOptional()
  @IsInt()
  position?: number;
}

export class ListTodosQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  listId?: string;

  /** open = por fazer e a andar; done = feitas e canceladas. */
  @IsOptional()
  @IsIn(['open', 'done', 'all'])
  status?: 'open' | 'done' | 'all';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class CreateTodoDto {
  @IsString()
  @MaxLength(60)
  listId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  notes?: string | null;

  /** Com dueAllDay, a meia-noite UTC do dia; sem, o instante. */
  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @IsBoolean()
  dueAllDay?: boolean;

  @IsOptional()
  @IsEnum(TodoPriority)
  priority?: TodoPriority | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  parentId?: string | null;

  /** Páginas do site (/MyHomeLab/…) ou URLs. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  links?: string[];
}

export class UpdateTodoDto {
  /** Mudar de lista (as sub-tarefas vão junto). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  listId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  notes?: string | null;

  @IsOptional()
  @IsDateString()
  dueAt?: string | null;

  @IsOptional()
  @IsBoolean()
  dueAllDay?: boolean;

  @IsOptional()
  @IsEnum(TodoPriority)
  priority?: TodoPriority | null;

  @IsOptional()
  @IsEnum(TodoStatus)
  status?: TodoStatus;

  /** Páginas do site (/MyHomeLab/…) ou URLs. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  links?: string[];
}
