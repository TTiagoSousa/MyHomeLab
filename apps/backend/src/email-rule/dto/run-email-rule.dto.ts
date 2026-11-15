import { IsEnum } from 'class-validator';

export type RunScope = 'INBOX' | 'ALL';

export class RunEmailRuleDto {
  @IsEnum(['INBOX', 'ALL'])
  scope: RunScope;
}
