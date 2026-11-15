import { PrismaService } from 'src/prisma/prisma.service';
import { DEFAULT_MODULES } from '../app-update.constants';

/** As definições das atualizações de um utilizador (com os valores por omissão). */
export async function readSetting(prisma: PrismaService, userId: string) {
  const setting = await prisma.updateWorkflowSetting.findUnique({
    where: { userId },
  });
  return {
    boardModules: setting?.boardModules ?? DEFAULT_MODULES,
  };
}
