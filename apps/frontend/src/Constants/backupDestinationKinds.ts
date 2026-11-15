export interface BackupDestinationKindInfo {
  kind: string;
  labelKey: string;
  available: boolean;
}

export const BACKUP_DESTINATION_KINDS: BackupDestinationKindInfo[] = [
  { kind: 'NEXTCLOUD', labelKey: 'backups.kinds.NEXTCLOUD', available: true },
  { kind: 'SMB', labelKey: 'backups.kinds.SMB', available: false },
  { kind: 'SFTP', labelKey: 'backups.kinds.SFTP', available: false },
  { kind: 'NFS', labelKey: 'backups.kinds.NFS', available: false },
];
