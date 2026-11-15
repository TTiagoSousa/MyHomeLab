import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  DocKind,
  DocLinkType,
  DocOwner,
} from 'src/generated/prisma/client/client';

export class DocLinkDto {
  @IsEnum(DocLinkType)
  type!: DocLinkType;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  targetId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;
}

export class CreateDocDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsEnum(DocKind)
  kind?: DocKind;

  /** Um tipo criado por ele (null tira-o). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  typeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  summary?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DocLinkDto)
  links?: DocLinkDto[];
}

export class UpdateDocDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsEnum(DocKind)
  kind?: DocKind;

  /** Um tipo criado por ele (null tira-o). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  typeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  summary?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DocLinkDto)
  links?: DocLinkDto[];
}

export class ListDocsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(DocKind)
  kind?: DocKind;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  typeId?: string;

  @IsOptional()
  @IsEnum(DocLinkType)
  linkType?: DocLinkType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetId?: string;

  /** '1' = só os obrigatórios. */
  @IsOptional()
  @IsIn(['1'])
  required?: '1';

  @IsOptional()
  @IsEnum(DocOwner)
  owner?: DocOwner;

  @IsOptional()
  @IsIn(['recent', 'title'])
  sort?: 'recent' | 'title';
}

export class ApproveDocProposalDto {
  /** O utilizador pode acertar o texto antes de aprovar. */
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  content?: string;
}

export class CreateDocTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;
}
