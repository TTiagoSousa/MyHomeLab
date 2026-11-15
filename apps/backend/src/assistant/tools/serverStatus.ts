import { Agent } from 'https';
import axios from 'axios';
import {
  createProxmoxClient,
  normalizeHost,
  ProxmoxConnection,
} from 'src/proxmox/proxmox.client';

const NO_SERVERS =
  'Este utilizador ainda não tem servidores configurados. Diz-lhe que os adiciona em ' +
  'Apps ligadas → Proxmox.';

/**
 * Os servidores a consultar: o pedido, se o modelo disser qual, ou todos.
 * Procura pelo nome, sem ligar a maiúsculas, primeiro igual e depois contido.
 */
function pickServers(
  servers: ProxmoxConnection[],
  wanted: string | undefined,
): ProxmoxConnection[] | string {
  if (servers.length === 0) return NO_SERVERS;
  if (!wanted?.trim()) return servers;

  const needle = wanted.trim().toLowerCase();
  const match =
    servers.find((server) => server.name.toLowerCase() === needle) ??
    servers.find((server) => server.name.toLowerCase().includes(needle));
  if (match) return [match];

  return `Não há nenhum servidor chamado "${wanted}". Os que existem: ${servers
    .map((server) => server.name)
    .join(', ')}.`;
}

export function listServers(servers: ProxmoxConnection[]): string {
  if (servers.length === 0) return NO_SERVERS;
  return servers
    .map(
      (server) =>
        `${server.name} — Proxmox em ${normalizeHost(server.host)}:${server.port}` +
        (server.id ? ` (id ${server.id})` : ''),
    )
    .join('\n');
}

export async function listProxmoxGuests(
  servers: ProxmoxConnection[],
  wanted?: string,
): Promise<string> {
  const picked = pickServers(servers, wanted);
  if (typeof picked === 'string') return picked;

  // Um servidor em baixo não esconde os outros: cada um responde por si.
  const sections = await Promise.all(
    picked.map(async (server) => {
      try {
        const guests = await createProxmoxClient(server).listGuests();
        const lines = guests.length
          ? guests.map(
              ({ kind, node, guest }) =>
                `[${kind === 'qemu' ? 'VM' : 'LXC'}] ${guest.name} — ${guest.status} (nó ${node})`,
            )
          : ['sem VMs nem containers'];
        return `${server.name}:\n${lines.join('\n')}`;
      } catch (error) {
        return `${server.name}: erro — ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    }),
  );

  return sections.join('\n\n');
}

export async function getProxmoxGuestStatus(
  servers: ProxmoxConnection[],
  name: string,
  wanted?: string,
): Promise<string> {
  const picked = pickServers(servers, wanted);
  if (typeof picked === 'string') return picked;

  const errors: string[] = [];
  for (const server of picked) {
    try {
      const client = createProxmoxClient(server);
      const ref = await client.findGuest(name);
      if (!ref) continue;

      const status = await client.getGuestStatus(ref);
      const memUsedMb = status.mem / 1024 / 1024;
      const memTotalMb = status.maxmem / 1024 / 1024;
      const cpuPercent = status.cpu * 100;

      return (
        `${ref.guest.name} (${ref.kind}, nó ${ref.node}, servidor ${server.name}) está ${status.status}.\n` +
        `Memória: ${memUsedMb.toFixed(0)} MB / ${memTotalMb.toFixed(0)} MB\n` +
        `CPU: ${cpuPercent.toFixed(1)}%`
      );
    } catch (error) {
      errors.push(
        `${server.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const notFound = `Não encontrei nenhuma VM ou container com o nome '${name}'.`;
  return errors.length
    ? `${notFound} Alguns servidores falharam:\n${errors.join('\n')}`
    : notFound;
}

// Usa axios (que assenta no módulo https do Node) e não o fetch global: o undici
// não consegue ligar-se de forma fiável aos serviços da LAN aqui — dá
// UND_ERR_CONNECT_TIMEOUT ao fim de 10s em hosts a que o módulo https responde em
// menos de 50ms. Os serviços a verificar são precisamente os da LAN.
export async function checkServiceStatus(url: string): Promise<string> {
  try {
    const response = await axios.head(url, {
      timeout: 8000,
      maxRedirects: 5,
      // Muitos serviços caseiros têm certificado self-signed; aqui só interessa
      // saber se respondem, não validar a cadeia.
      httpsAgent: new Agent({ rejectUnauthorized: false }),
      // Qualquer status é uma resposta — um 401 ou 403 significa que está de pé.
      validateStatus: () => true,
    });
    return `${url} respondeu com status ${response.status}`;
  } catch (error) {
    if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
      return `${url} não respondeu dentro de 8 segundos.`;
    }
    return `${url} não respondeu: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}
