import { ServerCommand } from 'src/generated/prisma/client/client';
import { AgentContext } from '../agents/agent-context';

const when = (date: Date | null) =>
  date ? date.toISOString().replace('T', ' ').slice(0, 16) : '—';

function describeResult(row: ServerCommand): string {
  const output = row.output?.trim() || '(sem saída)';
  if (row.status === 'DONE') {
    return `Correu (código ${row.exitCode ?? 0}):\n${output}`;
  }
  return `Falhou${row.exitCode !== null ? ` (código ${row.exitCode})` : ''}:\n${output}`;
}

export async function runCommand(
  context: AgentContext,
  input: { server?: string; command: string; reason?: string },
  agentKey: string,
): Promise<string> {
  const server = await context.serverCommands.findServerByName(
    context.userId,
    input.server,
  );
  if (typeof server === 'string') return server;
  const row = await context.serverCommands.request(context.userId, server, {
    command: input.command,
    reason: input.reason,
    requestedBy: agentKey,
    turnId: context.turnId,
  });
  return describeResult(row);
}

export async function inventory(
  context: AgentContext,
  input: { server?: string },
  agentKey: string,
): Promise<string> {
  const server = await context.serverCommands.findServerByName(
    context.userId,
    input.server,
  );
  if (typeof server === 'string') return server;
  const row = await context.serverCommands.inventory(
    context.userId,
    server,
    agentKey,
  );
  return row.status === 'DONE'
    ? `Inventário do ${server.name}:\n${row.output ?? ''}`
    : `O inventário do ${server.name} falhou:\n${row.output ?? ''}`;
}

export async function commandHistory(
  context: AgentContext,
  input: { server?: string; limit?: number },
): Promise<string> {
  const server = await context.serverCommands.findServerByName(
    context.userId,
    input.server,
  );
  if (typeof server === 'string') return server;
  const rows = await context.serverCommands.list(
    context.userId,
    server.id,
    input.limit ?? 15,
  );
  if (!rows.length) return `Ainda não correu nenhum comando no ${server.name}.`;
  return rows
    .map(
      (row) =>
        `${row.code} [${row.status}${row.autoApproved ? ', leitura' : ''}] ${when(row.createdAt)} ${row.command}` +
        (row.reason ? ` — ${row.reason}` : '') +
        (row.output
          ? `\n  ${row.output.trim().slice(0, 300).replace(/\n/g, '\n  ')}`
          : ''),
    )
    .join('\n');
}
