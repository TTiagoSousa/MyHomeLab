# Agents and tools

Jarvis is not a single prompt: it is a **team of agents per user**, stored in the database
and run by one generic executor. This guide explains how a request flows and how to add
abilities.

## Where things live

| Path | What |
|---|---|
| `apps/backend/src/agent/` | Agent CRUD, templates (`agent-templates.ts`), tool catalogue (`tool-catalog.ts`), prompt composition, permissions and per-app access |
| `apps/backend/src/assistant/assistant.service.ts` | Entry point for a chat turn, triggers, installs and verifications |
| `apps/backend/src/assistant/agents/team-agent.ts` | `runTeamAgent` — the generic executor |
| `apps/backend/src/assistant/agents/agent-context.ts` | `AgentContext` — everything a tool can use for this turn |
| `apps/backend/src/assistant/agents/prompts/` | Built-in instructions for the template agents |
| `apps/backend/src/assistant/toolsets/` | Tool definitions grouped by toolset, and `toolbox.ts` |
| `apps/backend/src/assistant/tools/` | Tool implementations (plain functions) |
| `apps/backend/src/claude-code/` | Claude CLI runner and the local MCP bridge |

## The team

- Each `Agent` row has a key, name, description, `reportsToId`, model (`OPUS` → the main
  model, `SONNET` → the agent model), effort (`LOW` / `MEDIUM` / `HIGH`), instructions
  (`prompt`, `null` = the built-in text), user extras (`extraPrompt`), tools and an active flag.
- The agent with no manager is the **CEO (Jarvis)** — the only one that answers the user.
  It cannot be deleted, deactivated or given a manager.
- A new user gets only Jarvis. Other agents (administrative assistant, infrastructure
  engineer, Proxmox operator, smart-home engineer, doctor, health data scientist, personal
  trainer, travel agent) are templates the user can add on the Workflow page, or ask Jarvis
  to create with its team tools.

## How a turn runs

```
POST /assistant/chat
  └─ AssistantService.ask(user, message, conversation)
       ├─ load the team, denied permissions, AI client, documents
       └─ runTeamAgent(CEO, messages, context, depth = 0)
            ├─ compose instructions  (built-in/custom prompt + extras + team + documents)
            ├─ build the toolbox     (agent tools, in catalogue order, guarded)
            ├─ add ask_<key> per active subordinate
            └─ run the model; each ask_<key> → runTeamAgent(subordinate, …, depth + 1)
```

- **Delegation is a tool.** `ask_<key>({ request })` runs the subordinate with the full
  request (prefixed with the current date and time) and returns its report. Max depth 5.
- **The engine** is the user's AI provider. With **Claude API** (`assistant/apiAgent.ts`) the
  backend runs a streaming tool loop on the Messages API (cached system prompt, sequential tool
  calls, failed tools returned as `is_error`); single-shot calls that force a tool are sent as
  structured outputs (`ai-credential/claudeApiClient.ts`). With **Claude Code** it is the Claude
  CLI (`claude -p`), run with a clean configuration: no user
  settings, plugins or built-in tools. The agent's tools are exposed through a local MCP
  bridge (`/internal/mcp/:id`, loopback only, per-run token). Tool errors return to the
  model as errors instead of failing the request.
- **Usage** (input, output, cache read/write tokens) is recorded per day, agent, model and
  source (`chat`, `schedule`, `study`, `install`, `verify`, `check`).
- **Docs used**: the documents listed in the request to read before acting, and any read with
  `docs_read`, are saved on the reply and shown under it.

### Prompt caching rule

The system prompt and tool list are a cached prefix. **Never put anything that changes
between turns (dates, ids, counters) into the instructions or the tool list** — it silently
destroys the cache. Variable state goes into the messages. This is also why tools are
always returned in catalogue order and why permissions are enforced in the handler, not by
removing tools.

### Instructions compose, never replace

`composeAgentPrompt` builds: the agent's instructions → the user's extra instructions
("follow them unless they contradict the rules above") → **YOUR TEAM** (subordinates) →
**WHO YOU REPORT TO** → the user's documents (the index only; the agent reads what it
needs with `docs_read`). An agent can change another agent's extra instructions only
through a two-turn proposal: propose in one turn, apply after the user says yes in the next — enforced in code by comparing turn ids.

## Tools and toolsets

A tool is an object with a name, description, JSON input schema and a handler:

```ts
export function buildTodoTools(context: AgentContext): AgentTool[] {
  return [
    {
      name: 'todo_lists',
      description: 'The user\'s task lists, with how many open tasks each has.',
      inputSchema: { type: 'object', properties: {} },
      handler: () => todoLists(context),
    },
    // …
  ];
}
```

Toolsets: `email`, `server`, `serverControl`, `serverShell`, `health`, `forgejo`,
`homeAssistant`, `adguard`, `nextcloud`, `docs`, `updates`, `schedules`, `board`, `todos`,
`team` (plus `trek`, `opengym` and others). `buildToolbox(names, context)` builds only the
toolsets an agent uses.

### Permissions (three layers)

| Layer | Where it is set | Enforced by |
|---|---|---|
| Tools | Workflow page (`Agent.tools`) | only assigned tools are built |
| Areas | Assistant → Settings → Permissions (read/write per area, for all agents) | `guardTools` + the tool's requirements |
| Apps / servers | each app or server page → Agents (none / read / write per agent) | `appAccessBlock` |

A blocked call returns a "no permission" message the model can explain to the user.

### Adding a tool

1. Implement the logic as a plain function in `assistant/tools/` (reuse module helpers
   where possible).
2. Add the tool to a toolset in `assistant/toolsets/` (or create a new toolset and register
   it in `toolsets/toolbox.ts`).
3. Register it in `agent/tool-catalog.ts`: name, toolset, group, `read` or `write`, and the
   short status line shown on the Workflow page while it runs.
4. Declare its permission area in `agent/helpers/assistantToolPermissions.ts`; if the
   toolset targets a connected app, map it in the app-access targets.
5. If template agents should get it, add it to `agent-templates.ts`. Existing teams keep
   their tool lists; users add it on the Workflow page (or ship a migration).
6. Write tool descriptions as instructions for the model: when to use it, what the inputs
   mean, what it returns.

## Rules live in documents

Behaviour that should be configurable (what needs approval, which commands are
destructive, how to update a given app) belongs in the user's **documents**, not in code
or prompts. The documents linked to an agent and to what it is working on are listed at
the end of the request, and the tools that change things wait until those are read with
`docs_read`. Agents propose changes to user documents and the user approves them. The code
measures, executes and records — the agents, following the rules, are the brakes.

For example, server shell commands run as soon as an agent calls them; the code only
classifies them as read or write for the log and takes a snapshot of a machine before a
command that changes it. The list of forbidden commands is in the server rules document.

## Triggers

`agent-schedule/` runs agent jobs: once, daily, weekly, monthly, or on a new update
(`ON_NEW_UPDATE`). A trigger names an agent and an instruction; the result can notify the
user or open a new conversation (`toChat`). Agents can create and edit triggers with the
`schedules` toolset.
