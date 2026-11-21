import { sshHostKeyFingerprint } from './sshHostKeyFingerprint';
import { hostKeyChangedMessage, verifySshHostKey } from './verifySshHostKey';

const repository = (stored: {
  sshHostKey: string | null;
  sshHostKeyAt: Date | null;
}) => ({
  find: jest.fn().mockResolvedValue(stored),
  storeIfEmpty: jest.fn().mockResolvedValue(stored.sshHostKey === null),
  clear: jest.fn(),
});

const FINGERPRINT = 'SHA256:abc';
const OTHER = 'SHA256:xyz';
const now = new Date('2026-11-21T10:00:00Z');

describe('verifySshHostKey', () => {
  it('guarda a chave no primeiro contacto e aceita', async () => {
    const repo = repository({ sshHostKey: null, sshHostKeyAt: null });
    const result = await verifySshHostKey(
      { id: 's1', sshHostKey: null, sshHostKeyAt: null },
      FINGERPRINT,
      repo,
      now,
    );
    expect(result).toBeNull();
    expect(repo.storeIfEmpty).toHaveBeenCalledWith('s1', FINGERPRINT, now);
  });

  it('aceita a mesma chave sem voltar a gravar', async () => {
    const repo = repository({ sshHostKey: FINGERPRINT, sshHostKeyAt: now });
    const result = await verifySshHostKey(
      { id: 's1', sshHostKey: FINGERPRINT, sshHostKeyAt: now },
      FINGERPRINT,
      repo,
    );
    expect(result).toBeNull();
    expect(repo.storeIfEmpty).not.toHaveBeenCalled();
  });

  it('recusa uma chave diferente com a data da guardada', async () => {
    const repo = repository({ sshHostKey: FINGERPRINT, sshHostKeyAt: now });
    const result = await verifySshHostKey(
      { id: 's1', sshHostKey: FINGERPRINT, sshHostKeyAt: now },
      OTHER,
      repo,
    );
    expect(result).toBe(hostKeyChangedMessage(now));
    expect(result).toContain('A chave SSH do servidor mudou desde');
    expect(result).toContain('confia na chave nova na página do servidor');
    expect(repo.storeIfEmpty).not.toHaveBeenCalled();
  });

  it('com a linha desatualizada, compara com a chave que outra ligação já guardou', async () => {
    const repo = repository({ sshHostKey: FINGERPRINT, sshHostKeyAt: now });
    const stale = { id: 's1', sshHostKey: null, sshHostKeyAt: null };
    expect(await verifySshHostKey(stale, FINGERPRINT, repo)).toBeNull();
    expect(await verifySshHostKey(stale, OTHER, repo)).toBe(
      hostKeyChangedMessage(now),
    );
  });
});

describe('sshHostKeyFingerprint', () => {
  it('usa o formato do OpenSSH (SHA256: e base64 sem =)', () => {
    const fingerprint = sshHostKeyFingerprint(Buffer.from('chave'));
    expect(fingerprint).toMatch(/^SHA256:[A-Za-z0-9+/]{43}$/);
  });
});
