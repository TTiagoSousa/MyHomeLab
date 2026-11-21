import { createHash } from 'crypto';

/**
 * A impressão digital da chave pública do servidor, no mesmo formato do OpenSSH
 * (`SHA256:` + base64 sem `=`), para se poder comparar com `ssh-keygen -lf`.
 */
export function sshHostKeyFingerprint(key: Buffer): string {
  const digest = createHash('sha256').update(key).digest('base64');
  return `SHA256:${digest.replace(/=+$/, '')}`;
}
