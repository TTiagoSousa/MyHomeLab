import { PartialType } from '@nestjs/mapped-types';
import { CreateEmailRuleDto } from './create-email-rule.dto';

export class UpdateEmailRuleDto extends PartialType(CreateEmailRuleDto) {}
