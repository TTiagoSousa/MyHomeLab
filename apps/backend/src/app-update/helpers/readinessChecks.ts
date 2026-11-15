import { ServerConnection } from 'src/generated/prisma/client/client';
import { UpdateCheck } from './updateChecks';

/** O que tem de existir para a atualização poder correr: o SSH do servidor e os comandos. */
export function readinessChecks(
  server: ServerConnection,
  commands: string[],
): UpdateCheck[] {
  return [
    {
      point: 'Os comandos (SSH) estão ligados no servidor',
      ok: Boolean(server.sshPrivateKey),
      evidence: server.sshPrivateKey
        ? `o ${server.name} tem o SSH ligado`
        : `o ${server.name} não tem o SSH ligado (Apps ligadas → Proxmox → ${server.name})`,
      source: 'code',
    },
    {
      point: 'Há comandos para a atualização',
      ok: commands.length > 0,
      evidence: commands.length
        ? `${commands.length} comando(s)`
        : 'ainda não há comandos (secção "Como atualizar" do documento da app)',
      source: 'code',
    },
  ];
}
