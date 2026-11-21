export interface StoredSshHostKey {
  sshHostKey: string | null;
  sshHostKeyAt: Date | null;
}

/** A impressão digital da chave SSH de cada servidor (confiança no primeiro contacto). */
export interface ServerHostKeyRepository {
  find(serverId: string): Promise<StoredSshHostKey | null>;
  /** Guarda só se ainda não houver nenhuma; devolve se guardou. */
  storeIfEmpty(
    serverId: string,
    fingerprint: string,
    at: Date,
  ): Promise<boolean>;
  clear(serverId: string): Promise<void>;
}
