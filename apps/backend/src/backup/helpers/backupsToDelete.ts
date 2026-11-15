import { BackupRetention } from 'src/generated/prisma/client/client';
import { isBackupFileName } from './backupFileName';

/**
 * Que backups antigos apagar depois de gravar um novo: com "substituir" fica
 * só o último, com "guardar os últimos N" ficam N, com "nunca apagar" nenhum.
 * Só conta ficheiros com o nome que o MyHomeLab dá — o resto da pasta não se toca.
 */
export function backupsToDelete(
  names: string[],
  prefix: string,
  retention: BackupRetention,
  keepCount: number,
) {
  if (retention === BackupRetention.KEEP_ALL) return [];
  const keep =
    retention === BackupRetention.REPLACE ? 1 : Math.max(1, keepCount);
  return names
    .filter((name) => isBackupFileName(prefix, name))
    .sort()
    .reverse()
    .slice(keep);
}
