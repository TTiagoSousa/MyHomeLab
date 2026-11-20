import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateDriveLinkDto {
  /** O link do Drive ou das Folhas (ou o id) da pasta ou do ficheiro. */
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  target: string;

  @IsUUID()
  projectId: string;
}
