import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaAgentRepository } from '../repositories/prisma/prisma-agent-repository';

/** Apaga um agente; quem lhe respondia passa a responder ao chefe dele. */
export async function deleteTeamAgent(
  id: string,
  repository: PrismaAgentRepository,
  userId: string,
): Promise<void> {
  const agent = await repository.findById(userId, id);
  if (!agent) throw new NotFoundException('Agente não encontrado');
  if (!agent.reportsToId) {
    throw new BadRequestException('O CEO não se pode apagar');
  }
  await repository.delete(agent);
}
