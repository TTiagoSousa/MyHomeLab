import { Readable } from 'stream';

/**
 * O ficheiro que um backup entrega para guardar no destino. Só o próprio MyHomeLab faz backups
 * aqui: os das apps ligadas saíram (o backup completo de uma app é o dela ou o do CT no Proxmox).
 */
export interface BackupFile {
  content: Buffer | Readable;
  sizeBytes: number | null;
  /** O que ficou de fora. */
  missing: string[];
  /** Arruma o que se criou só para este backup (ex: os ficheiros temporários). */
  cleanup?: () => Promise<void>;
}
