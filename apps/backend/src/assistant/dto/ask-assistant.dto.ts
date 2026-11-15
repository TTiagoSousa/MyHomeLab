import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AskAssistantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;

  /** A conversa onde continuar. Sem ela (e sem newConversation), continua a mais recente. */
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsBoolean()
  newConversation?: boolean;
}

export class RenameConversationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;
}
