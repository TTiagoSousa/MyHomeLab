import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AskAssistantDto {
  /** Pode vir vazia quando traz ficheiros. */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;

  /** A conversa onde continuar. Sem ela (e sem newConversation), continua a mais recente. */
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  // Em multipart (com ficheiros) chega como texto.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  newConversation?: boolean;
}

export class RenameConversationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;
}
