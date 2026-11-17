import {
  AppAccessLevel,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import { TOOL_CATALOG, ToolSet } from '../tool-catalog';

export type AccessTargetType = 'APP' | 'SERVER';

/** Uma app ligada ou um servidor, com os nomes por que um agente a pode chamar. */
export interface AccessTarget {
  type: AccessTargetType;
  id: string;
  provider: ConnectionProvider | 'PROXMOX';
  names: string[];
  /** Os níveis guardados por agente (sem linha: ler e mudar). */
  levels: Record<string, AppAccessLevel>;
}

/** De que app (ou servidor) é cada conjunto de ferramentas. */
export const SET_TARGET: Partial<
  Record<ToolSet, ConnectionProvider | 'PROXMOX'>
> = {
  email: ConnectionProvider.GMAIL,
  forgejo: ConnectionProvider.FORGEJO,
  homeAssistant: ConnectionProvider.HOME_ASSISTANT,
  adguard: ConnectionProvider.ADGUARD,
  nextcloud: ConnectionProvider.NEXTCLOUD,
  opengym: ConnectionProvider.OPENGYM,
  gametracker: ConnectionProvider.GAMETRACKER,
  immich: ConnectionProvider.IMMICH,
  paperless: ConnectionProvider.PAPERLESS,
  trek: ConnectionProvider.TREK,
  server: 'PROXMOX',
  serverControl: 'PROXMOX',
  serverShell: 'PROXMOX',
};

/** Os conjuntos de ferramentas que mexem numa app (para a página da app). */
export const setsOf = (provider: ConnectionProvider | 'PROXMOX'): ToolSet[] =>
  (Object.entries(SET_TARGET) as [ToolSet, string][])
    .filter(([, value]) => value === provider)
    .map(([set]) => set);

const RANK: Record<AppAccessLevel, number> = { NONE: 0, READ: 1, WRITE: 2 };

const allows = (level: AppAccessLevel | undefined, access: 'read' | 'write') =>
  RANK[level ?? AppAccessLevel.WRITE] >= (access === 'write' ? 2 : 1);

/** O nome que o agente usou na chamada (accountEmail, account, server). */
const selectorOf = (input: unknown): string | null => {
  const fields = (input ?? {}) as Record<string, unknown>;
  for (const key of ['accountEmail', 'account', 'server']) {
    const value = fields[key];
    if (typeof value === 'string' && value.trim())
      return value.trim().toLowerCase();
  }
  return null;
};

/**
 * Se um agente pode fazer esta chamada nesta app. Devolve o porquê quando não pode,
 * ou null. Sem nada guardado para o agente, pode (vale o que as ferramentas dele deixam).
 */
export function appAccessBlock(
  toolName: string,
  input: unknown,
  agentKey: string,
  targets: AccessTarget[],
): string | null {
  const tool = TOOL_CATALOG.find((item) => item.name === toolName);
  const provider = tool ? SET_TARGET[tool.set] : undefined;
  if (!tool || !provider) return null;
  const mine = targets.filter((target) => target.provider === provider);
  if (!mine.length || !mine.some((target) => target.levels[agentKey]))
    return null;

  const selector = selectorOf(input);
  const chosen = selector
    ? mine.filter((target) =>
        target.names.some(
          (name) =>
            name && (name.includes(selector) || selector.includes(name)),
        ),
      )
    : mine.length === 1
      ? mine
      : [];
  const what = tool.access === 'read' ? 'ler' : 'mudar';
  if (chosen.length) {
    const denied = chosen.find(
      (target) => !allows(target.levels[agentKey], tool.access),
    );
    return denied
      ? `Sem permissão: este agente não pode ${what} "${denied.names.find(Boolean) ?? denied.id}". Muda-se na página dessa app → Agentes.`
      : null;
  }
  if (mine.every((target) => !allows(target.levels[agentKey], tool.access))) {
    return `Sem permissão: este agente não pode ${what} nenhuma destas apps. Muda-se na página da app → Agentes.`;
  }
  return null;
}
