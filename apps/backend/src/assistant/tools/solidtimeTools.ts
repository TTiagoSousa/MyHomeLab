import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import {
  createSolidtimeClient,
  SolidtimeAggregate,
  SolidtimeEntry,
  SolidtimeEntryInput,
  SolidtimeGroup,
  SolidtimeObject,
  SolidtimeObjectKind,
  solidtimeTime,
} from 'src/solidtime/solidtime.client';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const hostOf = (url: string | null) => {
  try {
    return url ? new URL(url).host : '?';
  } catch {
    return '?';
  }
};

const accountLabel = (account: ConnectedAccount) =>
  `${account.displayName ?? 'solidtime'} (${hostOf(account.baseUrl)})`;

/** O solidtime a usar: o único, ou o que bate com o nome ou o endereço pedido. */
export async function solidtimeTarget(
  repository: PrismaConnectedAccountRepository,
  userId: string,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await repository.findAllByUser(userId, ConnectionProvider.SOLIDTIME)
  ).filter(
    (account) => account.isActive && account.baseUrl && account.accessToken,
  );
  if (!accounts.length) {
    return 'Não há nenhum solidtime ligado. Liga-o em Apps ligadas → solidtime.';
  }
  const matches = wanted?.trim()
    ? accounts.filter((account) =>
        normalize(accountLabel(account)).includes(normalize(wanted)),
      )
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o solidtime: ${accounts.map(accountLabel).join(', ')}.`;
  }
  return matches[0];
}

const describeError = (error: unknown) =>
  error instanceof AppIntegrationError || error instanceof Error
    ? error.message
    : String(error);

const safely = async (work: () => Promise<string>) => {
  try {
    return await work();
  } catch (error) {
    return `Falhou: ${describeError(error)}`;
  }
};

/** O cliente, a organização da conta (pelo membro guardado), o membro e o fuso do utilizador. */
async function sessionOf(account: ConnectedAccount) {
  const client = createSolidtimeClient(
    account.baseUrl ?? '',
    account.accessToken ?? '',
  );
  const [user, memberships] = await Promise.all([
    client.me(),
    client.memberships(),
  ]);
  const membership =
    memberships.find((item) => item.id === account.username) ??
    (memberships.length === 1 ? memberships[0] : undefined);
  if (!membership) {
    throw new AppIntegrationError(
      'APP_AUTH_FAILED',
      'O utilizador do token já não está na organização desta ligação. Liga o solidtime outra vez.',
    );
  }
  return {
    client,
    user,
    organization: membership.organization.id,
    organizationName: membership.organization.name,
    member: membership.id,
    role: membership.role,
    timeZone: user.timezone || 'UTC',
  };
}
type Session = Awaited<ReturnType<typeof sessionOf>>;

/** Quanto falta ao relógio de um fuso para o UTC, num instante (em ms). */
function zoneOffset(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return asUtc - instant;
}

/**
 * Uma hora local ("2026-11-17 09:30", "2026-11-17T09:30", "2026-11-17") no fuso do
 * utilizador, em UTC. "agora" (ou vazio) é agora.
 */
export function localToUtc(text: string | undefined, timeZone: string): Date {
  const trimmed = text?.trim() ?? '';
  if (!trimmed || /^(agora|now)$/i.test(trimmed)) return new Date();
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(trimmed)) return new Date(trimmed);
  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!match) {
    throw new Error(
      `Não percebi a hora "${text}". Usa AAAA-MM-DD HH:MM (na hora dele).`,
    );
  }
  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
  const wall = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  let instant = wall - zoneOffset(wall, timeZone);
  instant = wall - zoneOffset(instant, timeZone);
  return new Date(instant);
}

const localTime = (iso: string | null, timeZone: string) =>
  iso ? new Date(iso).toLocaleString('sv-SE', { timeZone }).slice(0, 16) : '—';

const hours = (seconds: number | null | undefined) => {
  const total = Math.max(0, Math.round((seconds ?? 0) / 60));
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`;
};

/** Os projetos, os clientes, as tarefas e as etiquetas, para mostrar nomes. */
async function namesOf(session: Session) {
  const { client, organization } = session;
  const [projects, clients, tasks, tags] = await Promise.all([
    client.objects(organization, 'projects'),
    client.objects(organization, 'clients'),
    client.objects(organization, 'tasks'),
    client.objects(organization, 'tags'),
  ]);
  const map = (items: SolidtimeObject[]) =>
    new Map(items.map((item) => [item.id, item]));
  return {
    projects: map(projects),
    clients: map(clients),
    tasks: map(tasks),
    tags: map(tags),
  };
}
type Names = Awaited<ReturnType<typeof namesOf>>;

/** Um id a partir do nome (exato, depois parcial) ou do próprio id; null ou "" tiram. */
function resolve(
  items: Map<string, SolidtimeObject>,
  wanted: string | null | undefined,
  what: string,
  only?: (item: SolidtimeObject) => boolean,
): string | null | undefined | { error: string } {
  if (wanted === undefined) return undefined;
  if (wanted === null || wanted === '') return null;
  if (items.has(wanted)) return wanted;
  const needle = normalize(wanted);
  const all = [...items.values()].filter((item) => !only || only(item));
  const exact = all.filter((item) => normalize(item.name) === needle);
  if (exact.length === 1) return exact[0].id;
  const partial = all.filter((item) => normalize(item.name).includes(needle));
  if (partial.length === 1) return partial[0].id;
  return {
    error: partial.length
      ? `Há vários ${what} com "${wanted}": ${partial.map((item) => item.name).join(', ')}. Diz qual.`
      : `Não há ${what} "${wanted}". Cria-o com solidtime_save_object, ou vê os que há com solidtime_catalog.`,
  };
}

const isError = (value: unknown): value is { error: string } =>
  typeof value === 'object' && value !== null && 'error' in value;

const entryLine = (entry: SolidtimeEntry, names: Names, timeZone: string) => {
  const project = entry.project_id
    ? names.projects.get(entry.project_id)
    : null;
  const client = project?.client_id
    ? names.clients.get(project.client_id)
    : null;
  return [
    `- ${localTime(entry.start, timeZone)} → ${entry.end ? localTime(entry.end, timeZone).slice(11) : 'a correr'} (${hours(entry.duration ?? (Date.now() - new Date(entry.start).getTime()) / 1000)})`,
    entry.description || '(sem descrição)',
    project
      ? `${project.name}${client ? ` · ${client.name}` : ''}`
      : 'sem projeto',
    entry.task_id
      ? `tarefa ${names.tasks.get(entry.task_id)?.name ?? '?'}`
      : null,
    entry.tags.length
      ? `#${entry.tags.map((id) => names.tags.get(id)?.name ?? '?').join(' #')}`
      : null,
    entry.billable ? 'faturável' : null,
    `id ${entry.id}`,
  ]
    .filter(Boolean)
    .join(' · ');
};

/** O início da semana dele (week_start) à meia-noite, no fuso dele. */
function weekStart(session: Session) {
  const days = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const first = Math.max(0, days.indexOf(session.user.week_start || 'monday'));
  const today = new Date().toLocaleDateString('sv-SE', {
    timeZone: session.timeZone,
  });
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const back = (weekday - first + 7) % 7;
  const start = new Date(`${today}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - back);
  return {
    today,
    week: start.toISOString().slice(0, 10),
  };
}

/** O resumo: quem é, a organização, o cronómetro, as horas de hoje e da semana e os projetos. */
export function overview(account: ConnectedAccount): Promise<string> {
  return safely(async () => {
    const session = await sessionOf(account);
    const { client, organization, member, timeZone } = session;
    const { today, week } = weekStart(session);
    const [names, active, byProject, todayTotal] = await Promise.all([
      namesOf(session),
      client.activeEntry(),
      client.aggregate(organization, {
        group: 'project',
        start: solidtimeTime(localToUtc(week, timeZone)),
        end: solidtimeTime(new Date()),
        member_id: member,
      }),
      client.aggregate(organization, {
        group: 'day',
        start: solidtimeTime(localToUtc(today, timeZone)),
        end: solidtimeTime(new Date()),
        member_id: member,
      }),
    ]);
    const projects = (byProject.grouped_data ?? [])
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 8)
      .map(
        (group) =>
          `${group.key ? (names.projects.get(group.key)?.name ?? '?') : 'sem projeto'} ${hours(group.seconds)}`,
      );
    return [
      `solidtime ${accountLabel(account)} · organização ${session.organizationName} (${session.role})`,
      `Utilizador: ${session.user.name} <${session.user.email}> · fuso ${timeZone}`,
      active
        ? `A contar agora: ${entryLine(active, names, timeZone)}`
        : 'Nenhum cronómetro a contar.',
      `Hoje: ${hours(todayTotal.seconds)} · esta semana (desde ${week}): ${hours(byProject.seconds)}`,
      projects.length ? `Na semana, por projeto: ${projects.join(', ')}` : null,
      `Projetos ${names.projects.size}, clientes ${names.clients.size}, tarefas ${names.tasks.size}, etiquetas ${names.tags.size}`,
    ]
      .filter(Boolean)
      .join('\n');
  });
}

/** Os registos de um período (as dele, ou de todos com everyone), com os nomes. */
export function listEntries(
  account: ConnectedAccount,
  input: {
    from?: string;
    to?: string;
    project?: string;
    everyone?: boolean;
    limit?: number;
  },
): Promise<string> {
  return safely(async () => {
    const session = await sessionOf(account);
    const { client, organization, member, timeZone } = session;
    const names = await namesOf(session);
    const project = resolve(names.projects, input.project, 'projeto');
    if (isError(project)) return project.error;
    const { week } = weekStart(session);
    const from = localToUtc(input.from ?? week, timeZone);
    const to = input.to
      ? new Date(
          localToUtc(input.to, timeZone).getTime() +
            (/\d:\d/.test(input.to) ? 0 : 86_400_000),
        )
      : new Date();
    const result = await client.entries(organization, {
      member_id: input.everyone ? undefined : member,
      start: solidtimeTime(from),
      end: solidtimeTime(to),
      project_ids: project ? [project] : undefined,
      limit: Math.min(Math.max(input.limit ?? 50, 1), 500),
    });
    if (!result.data.length) return 'Nenhum registo nesse período.';
    const total = result.data.reduce(
      (sum, entry) => sum + (entry.duration ?? 0),
      0,
    );
    return [
      `${result.data.length} registos (${hours(total)}), na hora dele (${timeZone}):`,
      ...result.data.map((entry) => entryLine(entry, names, timeZone)),
    ].join('\n');
  });
}

/** O relatório: as horas (e o custo) de um período agrupadas por dia, projeto, cliente… */
export function report(
  account: ConnectedAccount,
  input: {
    from?: string;
    to?: string;
    group?: SolidtimeGroup;
    sub_group?: SolidtimeGroup;
    everyone?: boolean;
  },
): Promise<string> {
  return safely(async () => {
    const session = await sessionOf(account);
    const { client, organization, member, timeZone } = session;
    const names = await namesOf(session);
    const { week } = weekStart(session);
    const from = localToUtc(input.from ?? week, timeZone);
    const to = input.to
      ? new Date(
          localToUtc(input.to, timeZone).getTime() +
            (/\d:\d/.test(input.to) ? 0 : 86_400_000),
        )
      : new Date();
    const result = await client.aggregate(organization, {
      group: input.group ?? 'project',
      sub_group: input.sub_group,
      start: solidtimeTime(from),
      end: solidtimeTime(to),
      member_id: input.everyone ? undefined : member,
    });
    const label = (type: string | null, key: string | null) => {
      if (key === null) return '(nenhum)';
      if (type === 'project') return names.projects.get(key)?.name ?? key;
      if (type === 'client') return names.clients.get(key)?.name ?? key;
      if (type === 'task') return names.tasks.get(key)?.name ?? key;
      if (type === 'tag') return names.tags.get(key)?.name ?? key;
      if (type === 'billable')
        return key === '1' || key === 'true' ? 'faturável' : 'não faturável';
      return key;
    };
    const lines = (node: SolidtimeAggregate, indent: string): string[] =>
      (node.grouped_data ?? [])
        .sort((a, b) => b.seconds - a.seconds)
        .flatMap((child) => [
          `${indent}- ${label(node.grouped_type, child.key)}: ${hours(child.seconds)}${child.cost ? ` · ${(child.cost / 100).toFixed(2)}` : ''}`,
          ...lines(child as SolidtimeAggregate, `${indent}  `),
        ]);
    return [
      `De ${localTime(from.toISOString(), timeZone).slice(0, 10)} a ${localTime(to.toISOString(), timeZone).slice(0, 10)}: ${hours(result.seconds)}${result.cost ? ` · custo ${(result.cost / 100).toFixed(2)}` : ''}`,
      ...lines(result, ''),
    ].join('\n');
  });
}

/** Os projetos (com cliente, horas gastas e estimadas), os clientes, as tarefas e as etiquetas. */
export function catalog(
  account: ConnectedAccount,
  input: { kind: SolidtimeObjectKind; query?: string; archived?: boolean },
): Promise<string> {
  return safely(async () => {
    const session = await sessionOf(account);
    const names = await namesOf(session);
    const items = [...names[input.kind].values()];
    const needle = input.query?.trim() ? normalize(input.query) : '';
    const found = items
      .filter((item) => !needle || normalize(item.name).includes(needle))
      .filter((item) => input.archived || !item.is_archived)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!found.length) return 'Nada com esse filtro.';
    return [
      `${found.length} ${input.kind}:`,
      ...found.map((item) =>
        [
          `- ${item.name} (id ${item.id})`,
          item.client_id
            ? `cliente ${names.clients.get(item.client_id)?.name ?? '?'}`
            : null,
          item.project_id
            ? `projeto ${names.projects.get(item.project_id)?.name ?? '?'}`
            : null,
          item.spent_time != null ? `gasto ${hours(item.spent_time)}` : null,
          item.estimated_time ? `estimado ${hours(item.estimated_time)}` : null,
          item.is_billable ? 'faturável' : null,
          item.is_archived ? 'arquivado' : null,
          item.is_done ? 'feita' : null,
        ]
          .filter(Boolean)
          .join(' · '),
      ),
    ].join('\n');
  });
}

/** Junta o projeto, a tarefa e as etiquetas pedidos (por nome) a um registo. */
function entryFields(
  names: Names,
  input: {
    description?: string | null;
    project?: string | null;
    task?: string | null;
    tags?: string[];
    billable?: boolean;
  },
): SolidtimeEntryInput | string {
  const fields: SolidtimeEntryInput = {};
  if (input.description !== undefined) fields.description = input.description;
  const project = resolve(names.projects, input.project, 'projeto');
  if (isError(project)) return project.error;
  if (project !== undefined) fields.project_id = project;
  const task = resolve(
    names.tasks,
    input.task,
    'tarefa',
    (item) => !project || item.project_id === project,
  );
  if (isError(task)) return task.error;
  if (task !== undefined) {
    fields.task_id = task;
    if (task && project === undefined) {
      fields.project_id = names.tasks.get(task)?.project_id ?? null;
    }
  }
  if (input.tags) {
    const ids: string[] = [];
    for (const tag of input.tags) {
      const id = resolve(names.tags, tag, 'etiqueta');
      if (isError(id)) return id.error;
      if (id) ids.push(id);
    }
    fields.tags = ids;
  }
  if (input.billable !== undefined) fields.billable = input.billable;
  else if (fields.project_id) {
    fields.billable = Boolean(
      names.projects.get(fields.project_id)?.is_billable,
    );
  }
  return fields;
}

/** Põe o cronómetro a contar (com descrição, projeto, tarefa e etiquetas). */
export function startTimer(
  account: ConnectedAccount,
  input: {
    description?: string;
    project?: string;
    task?: string;
    tags?: string[];
    billable?: boolean;
    start?: string;
    stop_running?: boolean;
  },
): Promise<string> {
  return safely(async () => {
    const session = await sessionOf(account);
    const { client, organization, member, timeZone } = session;
    const names = await namesOf(session);
    const active = await client.activeEntry();
    const lines: string[] = [];
    if (active) {
      if (!input.stop_running) {
        return `Já está a contar: ${entryLine(active, names, timeZone)}\nPara o parar e começar este, chama outra vez com stop_running: true.`;
      }
      const stopped = await client.updateEntry(organization, active.id, {
        member_id: member,
        start: active.start,
        end: solidtimeTime(new Date()),
      });
      lines.push(`Parei: ${entryLine(stopped, names, timeZone)}`);
    }
    const fields = entryFields(names, input);
    if (typeof fields === 'string') return fields;
    const entry = await client.createEntry(organization, {
      billable: false,
      ...fields,
      member_id: member,
      start: solidtimeTime(localToUtc(input.start, timeZone)),
      end: null,
    });
    lines.push(`A contar: ${entryLine(entry, names, timeZone)}`);
    return lines.join('\n');
  });
}

/** Para o cronómetro que está a contar. */
export function stopTimer(
  account: ConnectedAccount,
  input: { end?: string },
): Promise<string> {
  return safely(async () => {
    const session = await sessionOf(account);
    const { client, organization, member, timeZone } = session;
    const active = await client.activeEntry();
    if (!active) return 'Não há nenhum cronómetro a contar.';
    const names = await namesOf(session);
    const stopped = await client.updateEntry(organization, active.id, {
      member_id: member,
      start: active.start,
      end: solidtimeTime(localToUtc(input.end, timeZone)),
    });
    return `Parei: ${entryLine(stopped, names, timeZone)}`;
  });
}

/** Cria um registo de horas já passado, ou muda um (com id); devolve o de antes. */
export function saveEntry(
  account: ConnectedAccount,
  input: {
    id?: string;
    start?: string;
    end?: string;
    description?: string | null;
    project?: string | null;
    task?: string | null;
    tags?: string[];
    billable?: boolean;
  },
): Promise<string> {
  return safely(async () => {
    const session = await sessionOf(account);
    const { client, organization, member, timeZone } = session;
    const names = await namesOf(session);
    const fields = entryFields(names, input);
    if (typeof fields === 'string') return fields;
    if (!input.id) {
      if (!input.start || !input.end) {
        return 'Para um registo novo faltam o start e o end (AAAA-MM-DD HH:MM, na hora dele). Para contar a partir de agora, usa solidtime_start_timer.';
      }
      const entry = await client.createEntry(organization, {
        billable: false,
        ...fields,
        member_id: member,
        start: solidtimeTime(localToUtc(input.start, timeZone)),
        end: solidtimeTime(localToUtc(input.end, timeZone)),
      });
      return `Registei: ${entryLine(entry, names, timeZone)}`;
    }
    const found = await client.entries(organization, {
      member_id: member,
      limit: 500,
    });
    const before = found.data.find((entry) => entry.id === input.id);
    if (!before) {
      return `Não encontrei o registo ${input.id} entre os últimos dele.`;
    }
    const after = await client.updateEntry(organization, before.id, {
      member_id: member,
      start: input.start
        ? solidtimeTime(localToUtc(input.start, timeZone))
        : before.start,
      end: input.end
        ? solidtimeTime(localToUtc(input.end, timeZone))
        : before.end,
      description: before.description,
      project_id: before.project_id,
      task_id: before.task_id,
      tags: before.tags,
      billable: before.billable,
      ...fields,
    });
    return `Mudei: ${entryLine(after, names, timeZone)}\nAntes: ${entryLine(before, names, timeZone)}`;
  });
}

const KIND_LABEL: Record<SolidtimeObjectKind, string> = {
  projects: 'o projeto',
  clients: 'o cliente',
  tasks: 'a tarefa',
  tags: 'a etiqueta',
};

/** Cria ou muda um projeto, um cliente, uma tarefa ou uma etiqueta (nunca apaga). */
export function saveObject(
  account: ConnectedAccount,
  input: {
    kind: SolidtimeObjectKind;
    id?: string;
    name?: string;
    color?: string;
    client?: string | null;
    project?: string;
    billable?: boolean;
    archived?: boolean;
    done?: boolean;
    estimated_hours?: number | null;
  },
): Promise<string> {
  return safely(async () => {
    const session = await sessionOf(account);
    const { client, organization } = session;
    const names = await namesOf(session);
    const items = names[input.kind];
    const before = input.id
      ? (items.get(input.id) ??
        [...items.values()].find(
          (item) => normalize(item.name) === normalize(input.id ?? ''),
        ))
      : undefined;
    if (input.id && !before) {
      return `Não encontrei ${KIND_LABEL[input.kind]} "${input.id}".`;
    }
    const body: Record<string, unknown> = before ? { name: before.name } : {};
    if (input.name?.trim()) body.name = input.name.trim();
    if (!body.name) return 'Para criar falta o nome.';
    if (input.kind === 'projects') {
      body.color = input.color ?? before?.color ?? '#3b82f6';
      body.is_billable = input.billable ?? before?.is_billable ?? false;
      const owner = resolve(names.clients, input.client, 'cliente');
      if (isError(owner)) return owner.error;
      body.client_id =
        owner === undefined ? (before?.client_id ?? null) : owner;
      if (input.archived !== undefined) body.is_archived = input.archived;
      if (input.estimated_hours !== undefined) {
        body.estimated_time =
          input.estimated_hours === null
            ? null
            : Math.round(input.estimated_hours * 3600);
      }
    }
    if (input.kind === 'clients' && input.archived !== undefined) {
      body.is_archived = input.archived;
    }
    if (input.kind === 'tasks') {
      if (!before) {
        const project = resolve(names.projects, input.project, 'projeto');
        if (isError(project)) return project.error;
        if (!project) return 'Uma tarefa nova precisa do projeto.';
        body.project_id = project;
      }
      if (input.done !== undefined) body.is_done = input.done;
      if (input.estimated_hours !== undefined) {
        body.estimated_time =
          input.estimated_hours === null
            ? null
            : Math.round(input.estimated_hours * 3600);
      }
    }
    const saved = before
      ? await client.updateObject(organization, input.kind, before.id, body)
      : await client.createObject(organization, input.kind, body);
    return before
      ? `Mudei ${KIND_LABEL[input.kind]} «${saved.name}» (id ${saved.id}). Antes: «${before.name}»${before.is_archived ? ', arquivado' : ''}.`
      : `Criei ${KIND_LABEL[input.kind]} «${saved.name}» (id ${saved.id}).`;
  });
}
