import { ServerHostKeyRepository } from '../repositories/server-host-key-repository';

export interface HostKeyServer {
  id: string;
  sshHostKey: string | null;
  sshHostKeyAt: Date | null;
}

const formatDate = (at: Date) =>
  at.toLocaleString('pt-PT', {
    timeZone: 'Europe/Lisbon',
    dateStyle: 'short',
    timeStyle: 'short',
  });

export const hostKeyChangedMessage = (since: Date | null) =>
  `A chave SSH do servidor mudou desde ${since ? formatDate(since) : 'a última ligação'}. ` +
  'Se reinstalaste o servidor, confia na chave nova na página do servidor; se não, pode ser um ataque na rede.';

/**
 * Confiança no primeiro contacto: sem chave guardada, aceita e guarda a que o
 * servidor apresentou; com chave guardada, só aceita a mesma. Devolve `null`
 * quando aceita, ou a mensagem a mostrar quando recusa.
 *
 * O `server` pode vir desatualizado (os agentes guardam a linha do início do
 * turno): se outra ligação já guardou a chave entretanto, compara com essa.
 */
export async function verifySshHostKey(
  server: HostKeyServer,
  fingerprint: string,
  repository: ServerHostKeyRepository,
  now: Date = new Date(),
): Promise<string | null> {
  let stored = { key: server.sshHostKey, at: server.sshHostKeyAt };
  if (!stored.key) {
    if (await repository.storeIfEmpty(server.id, fingerprint, now)) return null;
    const current = await repository.find(server.id);
    stored = {
      key: current?.sshHostKey ?? null,
      at: current?.sshHostKeyAt ?? null,
    };
    if (!stored.key) return null;
  }
  return stored.key === fingerprint ? null : hostKeyChangedMessage(stored.at);
}
