import { randomUUID } from 'crypto';
import { Agent } from 'https';
import axios, { AxiosRequestConfig } from 'axios';
import { ConnectedAccount } from 'src/generated/prisma/client/client';
import {
  nextcloudForAccount,
  nextcloudRoot,
} from 'src/nextcloud/nextcloud.client';
import {
  RemoteTask,
  RemoteTaskInput,
  RemoteTaskList,
  TaskListNotFoundError,
  TaskRemote,
} from '../remote/taskRemote';
import {
  davResponses as responses,
  tagText,
  xmlEscape,
} from 'src/nextcloud/davXml';

const CALDAV = 'urn:ietf:params:xml:ns:caldav';

const PROPFIND_CALENDARS = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="${CALDAV}"><d:prop><d:resourcetype/><d:displayname/><c:supported-calendar-component-set/></d:prop></d:propfind>`;

const REPORT_TODOS = `<?xml version="1.0" encoding="UTF-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="${CALDAV}"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VTODO"/></c:comp-filter></c:filter></c:calendar-query>`;

// ── iCalendar (VTODO) ──

interface IcsLine {
  name: string;
  params: string;
  value: string;
}

const icsText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

const icsUntext = (value: string) =>
  value.replace(/\\([\\,;nN])/g, (_, char: string) =>
    char === 'n' || char === 'N' ? '\n' : char,
  );

const parseLine = (line: string): IcsLine => {
  const colon = line.search(/:(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  const head = colon < 0 ? line : line.slice(0, colon);
  const value = colon < 0 ? '' : line.slice(colon + 1);
  const semi = head.indexOf(';');
  return {
    name: (semi < 0 ? head : head.slice(0, semi)).toUpperCase(),
    params: semi < 0 ? '' : head.slice(semi),
    value,
  };
};

const lineText = (line: IcsLine) => `${line.name}${line.params}:${line.value}`;

/** As linhas do calendário (desdobradas) e onde começa e acaba o VTODO. */
function splitIcs(ics: string) {
  const lines = ics
    .replace(/\r?\n[ \t]/g, '')
    .split(/\r?\n/)
    .filter(Boolean);
  const start = lines.findIndex((line) => /^BEGIN:VTODO$/i.test(line));
  const end = lines.findIndex(
    (line, index) => index > start && /^END:VTODO$/i.test(line),
  );
  return { lines, start, end };
}

const lisbonDay = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(date);

/** "20261108", "20261108T093000Z" ou "20261108T093000" → instante (as sem Z contam como UTC). */
const parseIcsDate = (value: string): Date | null => {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/.exec(value);
  if (!match) return null;
  const [, y, m, d, hh = '00', mm = '00', ss = '00'] = match;
  return new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss));
};

/** O dia do prazo: o próprio (VALUE=DATE ou sem hora) ou o dia em Portugal do instante. */
const dueDayOf = (line: IcsLine | undefined) => {
  if (!line) return null;
  const date = parseIcsDate(line.value);
  if (!date) return null;
  return /T\d{6}Z$/i.test(line.value)
    ? lisbonDay(date)
    : date.toISOString().slice(0, 10);
};

/** Agora, ao segundo, como o iCalendar o guarda. */
const icsNow = () => {
  const date = new Date();
  date.setMilliseconds(0);
  return {
    date,
    text: date.toISOString().replace(/[-:]/g, '').replace('.000', ''),
  };
};

/** Uma tarefa do iCalendar (o VTODO de um ficheiro .ics). */
export function todoFromIcs(ics: string): RemoteTask | null {
  const { lines, start, end } = splitIcs(ics);
  if (start < 0 || end < 0) return null;
  const props = lines.slice(start + 1, end).map(parseLine);
  const get = (name: string) => props.find((prop) => prop.name === name);
  const uid = get('UID')?.value;
  if (!uid) return null;
  const status = get('STATUS')?.value.toUpperCase();
  const parent = props.find(
    (prop) =>
      prop.name === 'RELATED-TO' &&
      (!/RELTYPE=/i.test(prop.params) || /RELTYPE=PARENT/i.test(prop.params)),
  );
  const modified = get('LAST-MODIFIED') ?? get('DTSTAMP');
  return {
    id: uid,
    title: icsUntext(get('SUMMARY')?.value ?? ''),
    notes: get('DESCRIPTION') ? icsUntext(get('DESCRIPTION')!.value) : null,
    dueDay: dueDayOf(get('DUE')),
    completed: status === 'COMPLETED' || status === 'CANCELLED',
    completedAt: get('COMPLETED')
      ? parseIcsDate(get('COMPLETED')!.value)
      : null,
    parent: parent?.value ?? null,
    updated: (modified && parseIcsDate(modified.value)) || new Date(0),
  };
}

/**
 * O VTODO com o que muda (título, notas, prazo, feita); o resto do que lá estava
 * fica (prioridade, categorias, alarmes, a mãe). Um prazo no mesmo dia mantém a hora.
 */
export function todoToIcs(
  uid: string,
  task: RemoteTaskInput,
  existing: string | null,
  parentId?: string,
) {
  const now = icsNow();
  const base =
    existing && splitIcs(existing).start >= 0
      ? splitIcs(existing)
      : {
          lines: [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//MyHomeLab//Tarefas//PT',
            'BEGIN:VTODO',
            'END:VTODO',
            'END:VCALENDAR',
          ],
          start: 3,
          end: 4,
        };
  const old = base.lines.slice(base.start + 1, base.end).map(parseLine);
  const oldGet = (name: string) => old.find((prop) => prop.name === name);
  const replaced = new Set([
    'UID',
    'SUMMARY',
    'DESCRIPTION',
    'DUE',
    'STATUS',
    'COMPLETED',
    'PERCENT-COMPLETE',
    'LAST-MODIFIED',
    'DTSTAMP',
  ]);
  const kept = old.filter((prop) => !replaced.has(prop.name));
  if (parentId && !kept.some((prop) => prop.name === 'RELATED-TO'))
    kept.push({
      name: 'RELATED-TO',
      params: ';RELTYPE=PARENT',
      value: parentId,
    });

  const oldStatus = oldGet('STATUS')?.value.toUpperCase();
  const status = task.completed
    ? oldStatus === 'CANCELLED'
      ? 'CANCELLED'
      : 'COMPLETED'
    : oldStatus === 'IN-PROCESS'
      ? 'IN-PROCESS'
      : 'NEEDS-ACTION';
  const oldDue = oldGet('DUE');
  const due = !task.dueDay
    ? null
    : oldDue && dueDayOf(oldDue) === task.dueDay
      ? lineText(oldDue)
      : `DUE;VALUE=DATE:${task.dueDay.replace(/-/g, '')}`;
  const completedLine = task.completed
    ? oldGet('COMPLETED')
      ? lineText(oldGet('COMPLETED')!)
      : `COMPLETED:${now.text}`
    : null;

  const todo = [
    `UID:${uid}`,
    `DTSTAMP:${now.text}`,
    `LAST-MODIFIED:${now.text}`,
    `SUMMARY:${icsText(task.title)}`,
    ...(task.notes ? [`DESCRIPTION:${icsText(task.notes)}`] : []),
    ...(due ? [due] : []),
    `STATUS:${status}`,
    ...(completedLine ? [completedLine, 'PERCENT-COMPLETE:100'] : []),
    ...kept.map(lineText),
  ];
  const lines = [
    ...base.lines.slice(0, base.start + 1),
    ...todo,
    ...base.lines.slice(base.end),
  ];
  return { ics: `${lines.join('\r\n')}\r\n`, updated: now.date };
}

const slugOf = (title: string) =>
  `${
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'lista'
  }-${randomUUID().slice(0, 6)}`;

/**
 * As tarefas de um Nextcloud por CalDAV (as listas são os calendários com tarefas,
 * como na app Tasks), com a password de app. O id de cada tarefa é o UID; o
 * endereço de cada ficheiro guarda-se da última leitura da lista.
 */
export function nextcloudTasksRemote(account: ConnectedAccount): TaskRemote {
  const root = nextcloudRoot(account.baseUrl ?? account.caldavUrl ?? '');
  const http = axios.create({
    baseURL: root,
    auth: {
      username: account.caldavUsername ?? '',
      password: account.caldavPassword ?? '',
    },
    httpsAgent: new Agent({ rejectUnauthorized: false }),
    timeout: 30_000,
    responseType: 'text',
    transformResponse: (data: unknown) => data,
  });
  const files = new Map<string, { href: string; ics: string }>();
  let home: string | null = null;

  async function dav(config: AxiosRequestConfig, listId?: string) {
    try {
      return await http.request<string>(config);
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : null;
      if (status === 404 && listId) throw new TaskListNotFoundError(listId);
      if (status === 401)
        throw new Error(
          'O Nextcloud recusou o utilizador ou a password de app.',
        );
      throw new Error(
        `O Nextcloud (CalDAV) ${status ? `respondeu ${status}` : `não respondeu: ${error instanceof Error ? error.message : String(error)}`}`,
      );
    }
  }

  /** A pasta dos calendários: /remote.php/dav/calendars/<utilizador>/ (o id real vem da API). */
  async function calendarsHome() {
    if (!home) {
      const user = await nextcloudForAccount(account).me();
      home = `/remote.php/dav/calendars/${encodeURIComponent(user.id)}/`;
    }
    return home;
  }

  const hrefOf = (listId: string, taskId: string) =>
    files.get(taskId)?.href ?? `${listId}${encodeURIComponent(taskId)}.ics`;

  return {
    async listLists(): Promise<RemoteTaskList[]> {
      const response = await dav({
        method: 'PROPFIND',
        url: await calendarsHome(),
        headers: { Depth: '1', 'Content-Type': 'application/xml' },
        data: PROPFIND_CALENDARS,
      });
      return responses(response.data).flatMap((part) => {
        const href = tagText(part, 'href');
        const type = tagText(part, 'resourcetype') ?? '';
        const components =
          /<(?:[a-z0-9-]+:)?supported-calendar-component-set[\s\S]*?<\/(?:[a-z0-9-]+:)?supported-calendar-component-set>/i.exec(
            part,
          )?.[0] ?? '';
        if (
          !href ||
          !/calendar\s*\/>/i.test(type) ||
          !/name="VTODO"/i.test(components)
        )
          return [];
        return [
          {
            id: href.endsWith('/') ? href : `${href}/`,
            title: tagText(part, 'displayname') || href,
          },
        ];
      });
    },

    async createList(title: string): Promise<RemoteTaskList> {
      const id = `${await calendarsHome()}${slugOf(title)}/`;
      await dav({
        method: 'MKCOL',
        url: id,
        headers: { 'Content-Type': 'application/xml' },
        data: `<?xml version="1.0" encoding="UTF-8"?>
<d:mkcol xmlns:d="DAV:" xmlns:c="${CALDAV}"><d:set><d:prop><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><d:displayname>${xmlEscape(title)}</d:displayname><c:supported-calendar-component-set><c:comp name="VTODO"/></c:supported-calendar-component-set></d:prop></d:set></d:mkcol>`,
      });
      return { id, title };
    },

    async listTasks(listId: string): Promise<RemoteTask[]> {
      const response = await dav(
        {
          method: 'REPORT',
          url: listId,
          headers: { Depth: '1', 'Content-Type': 'application/xml' },
          data: REPORT_TODOS,
        },
        listId,
      );
      return responses(response.data).flatMap((part) => {
        const href = tagText(part, 'href');
        const ics = tagText(part, 'calendar-data');
        const task = ics ? todoFromIcs(ics) : null;
        if (!href || !ics || !task) return [];
        files.set(task.id, { href, ics });
        return [task];
      });
    },

    async insertTask(listId, task, parentId) {
      const uid = randomUUID();
      const written = todoToIcs(uid, task, null, parentId);
      const href = `${listId}${uid}.ics`;
      await dav(
        {
          method: 'PUT',
          url: href,
          headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'If-None-Match': '*',
          },
          data: written.ics,
        },
        listId,
      );
      files.set(uid, { href, ics: written.ics });
      return todoFromIcs(written.ics)!;
    },

    async patchTask(listId, taskId, task) {
      const written = todoToIcs(taskId, task, files.get(taskId)?.ics ?? null);
      const href = hrefOf(listId, taskId);
      await dav(
        {
          method: 'PUT',
          url: href,
          headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
          data: written.ics,
        },
        listId,
      );
      files.set(taskId, { href, ics: written.ics });
      return todoFromIcs(written.ics)!;
    },

    async deleteTask(listId, taskId) {
      try {
        await http.request({ method: 'DELETE', url: hrefOf(listId, taskId) });
      } catch (error) {
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : null;
        if (status !== 404)
          throw new Error(
            `Falha ao apagar a tarefa no Nextcloud: ${status ?? String(error)}`,
          );
      }
      files.delete(taskId);
    },
  };
}
