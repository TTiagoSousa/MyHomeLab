/**
 * A lista para o `trust proxy` do Express: sempre o nginx local (loopback) e os
 * endereços do TRUSTED_PROXIES (IPs ou CIDRs separados por vírgulas). Um endereço mal
 * escrito faz o Express falhar no arranque, o que é melhor do que confiar em nada.
 */
export function trustedProxies(value = process.env.TRUSTED_PROXIES): string[] {
  const extra = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return ['loopback', ...new Set(extra)];
}
