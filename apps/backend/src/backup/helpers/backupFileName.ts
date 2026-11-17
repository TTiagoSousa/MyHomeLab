const pad = (value: number) => String(value).padStart(2, '0');

/** "forgejo-2026-10-26_030000.tar" — na hora do servidor; ordena por data. */
export function backupFileName(
  prefix: string,
  date = new Date(),
  extension = 'json',
) {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${prefix}-${day}_${time}.${extension}`;
}

/** Só os ficheiros com este formato contam como backups nossos (e podem ser apagados). */
export function isBackupFileName(prefix: string, name: string) {
  return new RegExp(
    `^${prefix}-\\d{4}-\\d{2}-\\d{2}_\\d{6}\\.(?:json|zip|tar|sql\\.gz|mhlbackup)$`,
  ).test(name);
}
