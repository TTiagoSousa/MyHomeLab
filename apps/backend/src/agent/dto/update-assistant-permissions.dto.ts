import { ASSISTANT_PERMISSION_KEYS } from '@myhomelab/shared';
import { ArrayUnique, IsArray, IsIn } from 'class-validator';

export class UpdateAssistantPermissionsDto {
  /** As permissões desligadas, ex: ["health.write", "email.read"]. */
  @IsArray()
  @ArrayUnique()
  @IsIn(ASSISTANT_PERMISSION_KEYS, { each: true })
  denied: string[];
}
