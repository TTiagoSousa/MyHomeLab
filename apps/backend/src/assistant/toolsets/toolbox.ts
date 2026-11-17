import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import { TOOL_CATALOG, ToolSet } from 'src/agent/tool-catalog';
import { buildEmailTools } from './email-tools';
import { buildServerTools } from './server-tools';
import { buildHealthTools } from './health-tools';
import { buildTeamTools } from './team-tools';
import { buildForgejoTools } from './forgejo-tools';
import { buildHomeAssistantTools } from './home-assistant-tools';
import { buildAdguardTools } from './adguard-tools';
import { buildNextcloudTools } from './nextcloud-tools';
import { buildOpenGymTools } from './opengym-tools';
import { buildGameTrackerTools } from './gametracker-tools';
import { buildImmichTools } from './immich-tools';
import { buildPaperlessTools } from './paperless-tools';
import { buildTrekTools } from './trek-tools';
import { buildDocsTools } from './docs-tools';
import { buildUpdatesTools } from './updates-tools';
import { buildSchedulesTools } from './schedules-tools';
import { buildBoardTools } from './board-tools';
import { buildTodoTools } from './todo-tools';
import {
  buildServerControlTools,
  buildServerShellTools,
} from './server-control-tools';

const TOOL_SETS: Record<
  ToolSet,
  (context: AgentContext) => AgentTool[] | Promise<AgentTool[]>
> = {
  email: buildEmailTools,
  health: buildHealthTools,
  team: buildTeamTools,
  forgejo: buildForgejoTools,
  homeAssistant: buildHomeAssistantTools,
  adguard: buildAdguardTools,
  nextcloud: buildNextcloudTools,
  opengym: buildOpenGymTools,
  gametracker: buildGameTrackerTools,
  immich: buildImmichTools,
  paperless: buildPaperlessTools,
  trek: buildTrekTools,
  docs: buildDocsTools,
  updates: buildUpdatesTools,
  schedules: buildSchedulesTools,
  board: buildBoardTools,
  todos: buildTodoTools,
  serverControl: buildServerControlTools,
  serverShell: buildServerShellTools,
  server: async (context) =>
    buildServerTools(
      await context.serverConnections.connectionsFor(context.userId),
      context,
    ),
};

/**
 * As ferramentas de um agente, a partir dos nomes que tem na configuração. Só se
 * constroem os conjuntos de que ele precisa (os servidores, por exemplo, obrigam a ler
 * as ligações ao Proxmox), e vêm sempre pela ordem do catálogo: a lista tem de ser
 * igual de volta para volta para a cache valer.
 */
export async function buildToolbox(
  names: string[],
  context: AgentContext,
): Promise<AgentTool[]> {
  const wanted = TOOL_CATALOG.filter((entry) => names.includes(entry.name));
  const sets = [...new Set(wanted.map((entry) => entry.set))];
  const built = new Map(
    (await Promise.all(sets.map(async (set) => TOOL_SETS[set](context))))
      .flat()
      .map((tool) => [tool.name, tool]),
  );
  return wanted.flatMap((entry) => built.get(entry.name) ?? []);
}
