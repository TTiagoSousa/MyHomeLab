const PRIVATE_IPV4 = [/^10\./, /^127\./, /^192\.168\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./];
const PRIVATE_NAMES = [/^localhost$/, /\.lan$/, /\.local$/, /\.home\.arpa$/, /\.internal$/];

const hostOf = (server: string) => {
  const match = /^https?:\/\/(\[[^\]]+\]|[^/:]+)/i.exec(server.trim());
  return match ? match[1].toLowerCase().replace(/^\[|\]$/g, '') : '';
};

const isPrivateHost = (host: string) =>
  PRIVATE_IPV4.some((range) => range.test(host)) ||
  PRIVATE_NAMES.some((name) => name.test(host)) ||
  host === '::1' ||
  /^f[cd][0-9a-f]{2}:/.test(host);

export const isInsecureServer = (server: string) =>
  /^http:\/\//i.test(server.trim()) && !isPrivateHost(hostOf(server));
