import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderServiceDto {
  @IsUUID()
  categoryId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  orderedIds: string[];
}
