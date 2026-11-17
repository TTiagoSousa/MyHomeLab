import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetInstanceBackupPasswordDto {
  @IsString()
  @MinLength(10, {
    message: 'A password dos backups tem de ter pelo menos 10 caracteres.',
  })
  @MaxLength(200)
  password!: string;
}

export class RestoreInstanceBackupDto {
  @IsString()
  @MinLength(1, { message: 'Escreve a password do backup.' })
  @MaxLength(200)
  password!: string;
}
