import { IsEnum, IsIn, IsString, MaxLength, ValidateIf } from 'class-validator';
import { AppAccessLevel } from 'src/generated/prisma/client/client';

export class AgentAccessQueryDto {
  @IsIn(['APP', 'SERVER'])
  type!: 'APP' | 'SERVER';

  @IsString()
  @MaxLength(200)
  targetId!: string;
}

export class SaveAgentAccessDto extends AgentAccessQueryDto {
  @IsString()
  @MaxLength(60)
  agentKey!: string;

  /** null: volta a valer o que as ferramentas dele deixam. */
  @ValidateIf((_, value) => value !== null)
  @IsEnum(AppAccessLevel)
  level!: AppAccessLevel | null;
}
