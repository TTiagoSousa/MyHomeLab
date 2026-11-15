/**
 * O endereço a vigiar de uma app ligada: o baseUrl, ou — no Nextcloud, que só guarda
 * o endereço do CalDAV — a origem dele (https://cloud.exemplo:443). Sem endereço
 * http(s) não há serviço (ex.: Gmail).
 */
export function appMonitorTarget(account: {
  baseUrl: string | null;
  caldavUrl: string | null;
}): string | null {
  const baseUrl = account.baseUrl?.trim();
  if (baseUrl && /^https?:\/\/\S+$/i.test(baseUrl)) return baseUrl;
  const caldavUrl = account.caldavUrl?.trim();
  if (!caldavUrl) return null;
  try {
    const url = new URL(caldavUrl);
    return /^https?:$/.test(url.protocol) ? url.origin : null;
  } catch {
    return null;
  }
}
