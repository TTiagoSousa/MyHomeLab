import { PartialType } from '@nestjs/mapped-types';
import { CreateAgentDto } from './create-agent.dto';

/** Só muda o que vier. Nos agentes do site, `prompt` vazio volta às instruções do site. */
export class UpdateAgentDto extends PartialType(CreateAgentDto) {}
