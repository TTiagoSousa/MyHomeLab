export interface ServerKindInfo {
  kind: string;
  name: string;
  available: boolean;
  defaultPort?: number;
}

export const SERVER_KINDS: ServerKindInfo[] = [
  { kind: 'proxmox', name: 'Proxmox VE', available: true, defaultPort: 8006 },
  { kind: 'truenas', name: 'TrueNAS', available: false },
  { kind: 'docker', name: 'Docker', available: false },
  { kind: 'unraid', name: 'Unraid', available: false },
];

export const serverKindInfo = (kind: string) => SERVER_KINDS.find((entry) => entry.kind === kind);
