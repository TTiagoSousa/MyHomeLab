import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import {
  createPaperlessClient,
  PaperlessClient,
  PaperlessDocument,
  PaperlessMatching,
  PAPERLESS_MATCHING,
  PaperlessObject,
  PaperlessObjectKind,
} from 'src/paperless/paperless.client';
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
  `${account.displayName ?? 'Paperless'} (${hostOf(account.baseUrl)})`;

/** O Paperless a usar: o único, ou o que bate com o nome ou o endereço pedido. */
export async function paperlessTarget(
  repository: PrismaConnectedAccountRepository,
  userId: string,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await repository.findAllByUser(userId, ConnectionProvider.PAPERLESS)
  ).filter(
    (account) => account.isActive && account.baseUrl && account.accessToken,
  );
  if (!accounts.length) {
    return 'Não há nenhum Paperless ligado. Liga-o em Apps ligadas → Paperless.';
  }
  const matches = wanted?.trim()
    ? accounts.filter((account) =>
        normalize(accountLabel(account)).includes(normalize(wanted)),
      )
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o Paperless: ${accounts.map(accountLabel).join(', ')}.`;
  }
  return matches[0];
}

const clientOf = (account: ConnectedAccount) =>
  createPaperlessClient(account.baseUrl ?? '', account.accessToken ?? '');

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

const gigabytes = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;

/** As etiquetas, os correspondentes, os tipos e os caminhos, para mostrar nomes e não ids. */
async function namesOf(client: PaperlessClient) {
  const [tags, correspondents, types, paths] = await Promise.all([
    client.objects('tags'),
    client.objects('correspondents'),
    client.objects('document_types'),
    client.objects('storage_paths'),
  ]);
  const map = (items: PaperlessObject[]) =>
    new Map(items.map((item) => [item.id, item]));
  return {
    tags: map(tags),
    correspondents: map(correspondents),
    types: map(types),
    paths: map(paths),
  };
}
type Names = Awaited<ReturnType<typeof namesOf>>;

/**
 * Um id a partir do nome ou do número. Sem nada parecido devolve o texto do erro; null
 * ou "" querem dizer "tirar" (fica sem correspondente, tipo ou caminho).
 */
function resolve(
  items: Map<number, PaperlessObject>,
  wanted: string | number | null,
  what: string,
): number | null | string {
  if (wanted === null || wanted === '') return null;
  if (typeof wanted === 'number' || /^\d+$/.test(String(wanted))) {
    const id = Number(wanted);
    return items.has(id) ? id : `Não há ${what} com o id ${id}.`;
  }
  const needle = normalize(String(wanted));
  const all = [...items.values()];
  const exact = all.filter((item) => normalize(item.name) === needle);
  if (exact.length === 1) return exact[0].id;
  const partial = all.filter((item) => normalize(item.name).includes(needle));
  if (partial.length === 1) return partial[0].id;
  return partial.length
    ? `Há vários ${what} com "${wanted}": ${partial.map((item) => `${item.name} (${item.id})`).join(', ')}. Diz qual.`
    : `Não há ${what} "${wanted}". Cria-o com paperless_save_object, ou vê os que há com paperless_metadata.`;
}

const resolveMany = (
  items: Map<number, PaperlessObject>,
  wanted: (string | number)[] | undefined,
  what: string,
): number[] | string => {
  const ids: number[] = [];
  for (const item of wanted ?? []) {
    const id = resolve(items, item, what);
    if (typeof id === 'string') return id;
    if (id !== null) ids.push(id);
  }
  return ids;
};

const nameOf = (items: Map<number, PaperlessObject>, id: number | null) =>
  id === null ? null : (items.get(id)?.name ?? `#${id}`);

const documentLine = (document: PaperlessDocument, names: Names) =>
  [
    `- ${document.title} (id ${document.id})`,
    document.created?.slice(0, 10),
    nameOf(names.correspondents, document.correspondent),
    nameOf(names.types, document.document_type),
    document.tags.length
      ? `#${document.tags.map((id) => nameOf(names.tags, id)).join(' #')}`
      : null,
    document.archive_serial_number != null
      ? `ASN ${document.archive_serial_number}`
      : null,
    document.__search_hit__?.highlights
      ? `«${document.__search_hit__.highlights.replace(/<[^>]+>/g, '').slice(0, 160)}»`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

/** O resumo: versão, quem é o token, documentos, caixa de entrada e, de um superutilizador, a saúde. */
export function overview(account: ConnectedAccount): Promise<string> {
  return safely(async () => {
    const client = clientOf(account);
    const [{ user, version }, statistics] = await Promise.all([
      client.me(),
      client.statistics(),
    ]);
    const [status, tasks] = await Promise.all([
      client.status().catch(() => null),
      client.tasks().catch(() => null),
    ]);
    const failed = (tasks ?? []).filter(
      (task) => task.status === 'FAILURE' && !task.acknowledged,
    );
    const health = status
      ? [
          `Base de dados ${status.database.status}`,
          `Redis ${status.tasks.redis_status}`,
          `Celery ${status.tasks.celery_status}`,
          `índice ${status.tasks.index_status}`,
          `classificador ${status.tasks.classifier_status}${status.tasks.classifier_last_trained ? ` (treinado ${status.tasks.classifier_last_trained.slice(0, 10)})` : ''}`,
          `verificação ${status.tasks.sanity_check_status}${status.tasks.sanity_check_last_run ? ` (${status.tasks.sanity_check_last_run.slice(0, 10)})` : ''}`,
        ].join(', ')
      : null;
    return [
      `Paperless ${accountLabel(account)} · versão ${version ?? account.appVersion ?? '?'}${account.appLatestVersion && account.appLatestVersion !== (version ?? account.appVersion) ? ` (há a ${account.appLatestVersion})` : ''}`,
      `Token de: ${user.username}${user.is_superuser ? ' (superutilizador)' : user.is_staff ? ' (staff)' : ''}`,
      `Documentos: ${statistics.documents_total}${statistics.documents_inbox != null ? `, ${statistics.documents_inbox} na caixa de entrada (por arrumar)` : ''}`,
      `Etiquetas ${statistics.tag_count ?? '?'}, correspondentes ${statistics.correspondent_count ?? '?'}, tipos ${statistics.document_type_count ?? '?'}, caminhos ${statistics.storage_path_count ?? '?'}${statistics.current_asn != null ? ` · último ASN ${statistics.current_asn}` : ''}`,
      status
        ? `Disco: ${gigabytes(status.storage.total - status.storage.available)} de ${gigabytes(status.storage.total)} (livres ${gigabytes(status.storage.available)})`
        : null,
      health ? `Saúde: ${health}` : null,
      status?.database.migration_status?.unapplied_migrations.length
        ? `Migrações por aplicar: ${status.database.migration_status.unapplied_migrations.length}`
        : null,
      failed.length
        ? `Tarefas falhadas por ver (${failed.length}):\n${failed
            .slice(0, 10)
            .map(
              (task) =>
                `- ${task.task_file_name ?? task.type} (${task.date_created.slice(0, 10)}): ${(task.result ?? '').slice(0, 200)}`,
            )
            .join('\n')}`
        : null,
      status ? null : 'Saúde e disco: só com o token de um superutilizador.',
    ]
      .filter(Boolean)
      .join('\n');
  });
}

/** Procura documentos: com query, a pesquisa de texto inteiro; os filtros juntam-se. */
export function searchDocuments(
  account: ConnectedAccount,
  input: {
    query?: string;
    title?: string;
    tags?: (string | number)[];
    correspondent?: string | number;
    document_type?: string | number;
    storage_path?: string | number;
    created_after?: string;
    created_before?: string;
    inbox?: boolean;
    limit?: number;
  },
): Promise<string> {
  return safely(async () => {
    const client = clientOf(account);
    const names = await namesOf(client);
    const tags = resolveMany(names.tags, input.tags, 'etiqueta');
    if (typeof tags === 'string') return tags;
    const one = (
      items: Map<number, PaperlessObject>,
      wanted: string | number | undefined,
      what: string,
    ) => (wanted === undefined ? undefined : resolve(items, wanted, what));
    const correspondent = one(
      names.correspondents,
      input.correspondent,
      'correspondente',
    );
    const documentType = one(names.types, input.document_type, 'tipo');
    const storagePath = one(names.paths, input.storage_path, 'caminho');
    for (const value of [correspondent, documentType, storagePath]) {
      if (typeof value === 'string') return value;
    }
    const result = await client.documents({
      query: input.query?.trim() || undefined,
      titleContent: input.title?.trim() || undefined,
      tags,
      correspondent: (correspondent as number | null | undefined) ?? undefined,
      documentType: (documentType as number | null | undefined) ?? undefined,
      storagePath: (storagePath as number | null | undefined) ?? undefined,
      createdAfter: input.created_after,
      createdBefore: input.created_before,
      inbox: input.inbox,
      pageSize: input.limit,
    });
    if (!result.results.length) return 'Nenhum documento com essa pesquisa.';
    return [
      `${result.count} ${result.count === 1 ? 'documento' : 'documentos'}${result.count > result.results.length ? ` (mostro ${result.results.length})` : ''}:`,
      ...result.results.map((document) => documentLine(document, names)),
    ].join('\n');
  });
}

/** Um documento: tudo o que o arruma, as notas, os campos e o começo do texto (OCR). */
export function documentDetail(
  account: ConnectedAccount,
  input: { id: number; chars?: number },
): Promise<string> {
  return safely(async () => {
    const client = clientOf(account);
    const [document, names, fields] = await Promise.all([
      client.document(input.id),
      namesOf(client),
      client.customFields().catch(() => [] as PaperlessObject[]),
    ]);
    const fieldNames = new Map(fields.map((field) => [field.id, field.name]));
    const chars = Math.min(Math.max(input.chars ?? 3000, 200), 20000);
    const content = document.content ?? '';
    return [
      `${document.title} (id ${document.id})`,
      `Data: ${document.created?.slice(0, 10)} · adicionado ${document.added?.slice(0, 10) ?? '?'}${document.page_count ? ` · ${document.page_count} páginas` : ''}${document.original_file_name ? ` · ficheiro ${document.original_file_name}` : ''}`,
      `Correspondente: ${nameOf(names.correspondents, document.correspondent) ?? '—'} · Tipo: ${nameOf(names.types, document.document_type) ?? '—'} · Caminho: ${nameOf(names.paths, document.storage_path) ?? '—'} · ASN: ${document.archive_serial_number ?? '—'}`,
      `Etiquetas: ${document.tags.length ? document.tags.map((id) => nameOf(names.tags, id)).join(', ') : '—'}`,
      document.custom_fields?.length
        ? `Campos: ${document.custom_fields.map((field) => `${fieldNames.get(field.field) ?? `#${field.field}`} = ${JSON.stringify(field.value)}`).join(', ')}`
        : null,
      document.notes?.length
        ? `Notas:\n${document.notes.map((note) => `- ${note.created.slice(0, 10)}: ${note.note}`).join('\n')}`
        : null,
      content
        ? `Texto${content.length > chars ? ` (os primeiros ${chars} de ${content.length} caracteres)` : ''}:\n${content.slice(0, chars)}`
        : 'Sem texto (o OCR não leu nada).',
    ]
      .filter(Boolean)
      .join('\n');
  });
}

const KIND_LABEL: Record<PaperlessObjectKind, string> = {
  tags: 'a etiqueta',
  correspondents: 'o correspondente',
  document_types: 'o tipo',
  storage_paths: 'o caminho',
};

const MATCHING_LABEL: Record<PaperlessMatching, string> = {
  none: 'nenhuma',
  any: 'qualquer palavra',
  all: 'todas as palavras',
  literal: 'texto exato',
  regex: 'expressão regular',
  fuzzy: 'aproximada',
  auto: 'automática (aprende)',
};

/** As etiquetas, os correspondentes, os tipos, os caminhos ou os campos, com ids e regras. */
export function listMetadata(
  account: ConnectedAccount,
  input: { kind: PaperlessObjectKind | 'custom_fields'; query?: string },
): Promise<string> {
  return safely(async () => {
    const client = clientOf(account);
    const items =
      input.kind === 'custom_fields'
        ? await client.customFields()
        : await client.objects(input.kind);
    const needle = input.query?.trim() ? normalize(input.query) : '';
    const found = items
      .filter((item) => !needle || normalize(item.name).includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!found.length) return 'Nada com esse nome.';
    return [
      `${found.length} ${input.kind}:`,
      ...found.map((item) =>
        [
          `- ${item.name} (id ${item.id})`,
          item.document_count != null ? `${item.document_count} docs` : null,
          item.data_type ? `tipo ${item.data_type}` : null,
          item.path ? `caminho ${item.path}` : null,
          item.is_inbox_tag ? 'etiqueta da caixa de entrada' : null,
          item.matching_algorithm != null && item.matching_algorithm > 0
            ? `associa: ${MATCHING_LABEL[PAPERLESS_MATCHING[item.matching_algorithm]] ?? item.matching_algorithm}${item.match ? ` "${item.match}"` : ''}`
            : null,
        ]
          .filter(Boolean)
          .join(' · '),
      ),
    ].join('\n');
  });
}

/** As tarefas recentes (ficheiros a processar, falhas). */
export function listTasks(
  account: ConnectedAccount,
  input: { failed_only?: boolean; limit?: number },
): Promise<string> {
  return safely(async () => {
    const tasks = await clientOf(account).tasks();
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
    const found = tasks.filter(
      (task) => !input.failed_only || task.status === 'FAILURE',
    );
    if (!found.length) return 'Sem tarefas com esse filtro.';
    return found
      .slice(0, limit)
      .map(
        (task) =>
          `- ${task.task_file_name ?? task.type} · ${task.status} · ${task.date_created.slice(0, 16).replace('T', ' ')}${task.related_document ? ` · documento ${task.related_document}` : ''}${task.result && task.status !== 'SUCCESS' ? ` · ${task.result.slice(0, 200)}` : ''}`,
      )
      .join('\n');
  });
}

/** Os fluxos de trabalho e as regras do correio (só para ver). */
export function listAutomations(account: ConnectedAccount): Promise<string> {
  return safely(async () => {
    const client = clientOf(account);
    const [workflows, rules] = await Promise.all([
      client.list('/workflows/').catch(() => []),
      client.list('/mail_rules/').catch(() => []),
    ]);
    const line = (item: Record<string, unknown>) =>
      `- ${String(item.name)} (id ${String(item.id)})${item.enabled === false ? ' · desligado' : ''}${item.order != null ? ` · ordem ${JSON.stringify(item.order)}` : ''}`;
    return [
      `Fluxos de trabalho (${workflows.length}):`,
      ...(workflows.length ? workflows.map(line) : ['(nenhum)']),
      `Regras do correio (${rules.length}):`,
      ...(rules.length ? rules.map(line) : ['(nenhuma)']),
      'Mudar fluxos e regras do correio faz-se no Paperless; daqui só se veem.',
    ].join('\n');
  });
}

/**
 * Arruma um documento: título, etiquetas (pôr e tirar), correspondente, tipo, caminho,
 * data, ASN e uma nota. Devolve o que estava antes.
 */
export function updateDocument(
  account: ConnectedAccount,
  input: {
    id: number;
    title?: string;
    add_tags?: (string | number)[];
    remove_tags?: (string | number)[];
    correspondent?: string | number | null;
    document_type?: string | number | null;
    storage_path?: string | number | null;
    created?: string;
    archive_serial_number?: number | null;
    note?: string;
  },
): Promise<string> {
  return safely(async () => {
    const client = clientOf(account);
    const [document, names] = await Promise.all([
      client.document(input.id),
      namesOf(client),
    ]);
    const add = resolveMany(names.tags, input.add_tags, 'etiqueta');
    if (typeof add === 'string') return add;
    const remove = resolveMany(names.tags, input.remove_tags, 'etiqueta');
    if (typeof remove === 'string') return remove;
    const patch: Partial<PaperlessDocument> = {};
    const before: string[] = [];
    if (input.title?.trim() && input.title.trim() !== document.title) {
      patch.title = input.title.trim();
      before.push(`título «${document.title}»`);
    }
    if (add.length || remove.length) {
      patch.tags = [...new Set([...document.tags, ...add])].filter(
        (id) => !remove.includes(id),
      );
      before.push(
        `etiquetas ${document.tags.map((id) => nameOf(names.tags, id)).join(', ') || '—'}`,
      );
    }
    const single = [
      ['correspondent', names.correspondents, 'correspondente'],
      ['document_type', names.types, 'tipo'],
      ['storage_path', names.paths, 'caminho'],
    ] as const;
    for (const [key, items, what] of single) {
      if (input[key] === undefined) continue;
      const id = resolve(items, input[key], what);
      if (typeof id === 'string') return id;
      patch[key] = id;
      before.push(`${what} ${nameOf(items, document[key]) ?? '—'}`);
    }
    if (input.created) {
      patch.created = input.created;
      before.push(`data ${document.created?.slice(0, 10)}`);
    }
    if (input.archive_serial_number !== undefined) {
      patch.archive_serial_number = input.archive_serial_number;
      before.push(`ASN ${document.archive_serial_number ?? '—'}`);
    }
    if (!Object.keys(patch).length && !input.note?.trim()) {
      return 'Não há nada a mudar no documento.';
    }
    const lines = [`Documento «${document.title}» (id ${document.id}):`];
    if (Object.keys(patch).length) {
      const after = await client.updateDocument(document.id, patch);
      lines.push(documentLine(after, names), `Antes: ${before.join(' · ')}.`);
    }
    if (input.note?.trim()) {
      await client.addNote(document.id, input.note.trim());
      lines.push('Acrescentei a nota.');
    }
    return lines.join('\n');
  });
}

/** O mesmo arranjo em vários documentos de uma vez (bulk_edit). */
export function bulkEdit(
  account: ConnectedAccount,
  input: {
    documents: number[];
    add_tags?: (string | number)[];
    remove_tags?: (string | number)[];
    correspondent?: string | number | null;
    document_type?: string | number | null;
    storage_path?: string | number | null;
    confirm?: boolean;
  },
): Promise<string> {
  return safely(async () => {
    const documents = [...new Set(input.documents ?? [])];
    if (!documents.length) return 'Faltam os documentos (ids).';
    const client = clientOf(account);
    const names = await namesOf(client);
    const add = resolveMany(names.tags, input.add_tags, 'etiqueta');
    if (typeof add === 'string') return add;
    const remove = resolveMany(names.tags, input.remove_tags, 'etiqueta');
    if (typeof remove === 'string') return remove;
    const steps: {
      label: string;
      run: () => Promise<unknown>;
    }[] = [];
    if (add.length || remove.length) {
      steps.push({
        label: `etiquetas${add.length ? ` + ${add.map((id) => nameOf(names.tags, id)).join(', ')}` : ''}${remove.length ? ` − ${remove.map((id) => nameOf(names.tags, id)).join(', ')}` : ''}`,
        run: () =>
          client.bulkEdit(documents, 'modify_tags', {
            add_tags: add,
            remove_tags: remove,
          }),
      });
    }
    const single = [
      [
        'correspondent',
        names.correspondents,
        'correspondente',
        'set_correspondent',
      ],
      ['document_type', names.types, 'tipo', 'set_document_type'],
      ['storage_path', names.paths, 'caminho', 'set_storage_path'],
    ] as const;
    for (const [key, items, what, method] of single) {
      if (input[key] === undefined) continue;
      const id = resolve(items, input[key], what);
      if (typeof id === 'string') return id;
      steps.push({
        label: `${what} → ${nameOf(items, id) ?? '(nenhum)'}`,
        run: () => client.bulkEdit(documents, method, { [key]: id }),
      });
    }
    if (!steps.length) return 'Não há nada a mudar.';
    const summary = `${documents.length} documentos: ${steps.map((step) => step.label).join('; ')}`;
    if (!input.confirm) {
      return `Isto muda ${summary}.\nConfirma com ele e volta a chamar com confirm: true.`;
    }
    for (const step of steps) await step.run();
    return `Mudei ${summary}. O Paperless aplica em segundo plano (alguns segundos).`;
  });
}

/** Cria ou muda uma etiqueta, um correspondente, um tipo ou um caminho, com a regra de associação. */
export function saveObject(
  account: ConnectedAccount,
  input: {
    kind: PaperlessObjectKind;
    id?: number;
    name?: string;
    matching?: PaperlessMatching;
    match?: string;
    case_insensitive?: boolean;
    color?: string;
    inbox?: boolean;
    path?: string;
  },
): Promise<string> {
  return safely(async () => {
    const client = clientOf(account);
    const body: Record<string, unknown> = {};
    if (input.name?.trim()) body.name = input.name.trim();
    if (input.matching) {
      body.matching_algorithm = PAPERLESS_MATCHING.indexOf(input.matching);
    }
    if (input.match !== undefined) body.match = input.match;
    if (input.case_insensitive !== undefined) {
      body.is_insensitive = input.case_insensitive;
    }
    if (input.kind === 'tags') {
      if (input.color) body.color = input.color;
      if (input.inbox !== undefined) body.is_inbox_tag = input.inbox;
    }
    if (input.kind === 'storage_paths' && input.path !== undefined) {
      body.path = input.path;
    }
    if (input.id === undefined) {
      if (!body.name) return 'Para criar falta o nome.';
      if (input.kind === 'storage_paths' && !body.path) {
        return 'Um caminho novo precisa do path (ex.: "{{ correspondent }}/{{ created_year }}/{{ title }}").';
      }
      const created = await client.createObject(input.kind, body);
      return `Criei ${KIND_LABEL[input.kind]} «${created.name}» (id ${created.id}).`;
    }
    if (!Object.keys(body).length) return 'Não há nada a mudar.';
    const before = (await client.objects(input.kind)).find(
      (item) => item.id === input.id,
    );
    if (!before)
      return `Não encontrei ${KIND_LABEL[input.kind]} com o id ${input.id}.`;
    const after = await client.updateObject(input.kind, input.id, body);
    return `Mudei ${KIND_LABEL[input.kind]} «${after.name}» (id ${after.id}). Antes: nome «${before.name}», associação ${PAPERLESS_MATCHING[before.matching_algorithm ?? 0] ?? before.matching_algorithm}${before.match ? ` "${before.match}"` : ''}.`;
  });
}

/** Os campos com segredos (as chaves da IA e do OCR remoto) não se mostram nem se mudam daqui. */
const SECRET_SETTING = /api_key|password|secret/i;
const HIDDEN_SETTING = new Set([
  'id',
  'app_logo',
  'externally_configured_variables',
]);

/** A configuração da aplicação (Configuração no Paperless; superutilizador). */
export function readSettings(account: ConnectedAccount): Promise<string> {
  return safely(async () => {
    const config = await clientOf(account).config();
    const locked = new Set(
      Object.keys(
        (config.externally_configured_variables as Record<string, unknown>) ??
          {},
      ),
    );
    return [
      'Configuração da aplicação (null = usa o valor do ficheiro de ambiente):',
      ...Object.entries(config)
        .filter(([key]) => !HIDDEN_SETTING.has(key))
        .map(
          ([key, value]) =>
            `- ${key} = ${SECRET_SETTING.test(key) ? (value ? '(definido)' : 'null') : JSON.stringify(value)}${locked.has(key) ? ' (fixado no ambiente: não muda daqui)' : ''}`,
        ),
    ].join('\n');
  });
}

/** Muda a configuração da aplicação: só o que vem em changes; sem confirm mostra o antes → depois. */
export function changeSettings(
  account: ConnectedAccount,
  input: { changes: Record<string, unknown>; confirm?: boolean },
): Promise<string> {
  return safely(async () => {
    if (
      !input.changes ||
      typeof input.changes !== 'object' ||
      !Object.keys(input.changes).length
    ) {
      return 'Falta o que mudar (changes), ex.: {"language":"por+eng"}.';
    }
    const client = clientOf(account);
    const config = await client.config();
    const changes: string[] = [];
    for (const [key, value] of Object.entries(input.changes)) {
      if (!(key in config) || HIDDEN_SETTING.has(key)) {
        return `O Paperless não tem a definição ${key}. Vê as que há com paperless_settings.`;
      }
      if (SECRET_SETTING.test(key)) {
        return `A ${key} é um segredo: muda-se no Paperless, não daqui.`;
      }
      if (JSON.stringify(config[key]) !== JSON.stringify(value)) {
        changes.push(
          `- ${key}: ${JSON.stringify(config[key])} → ${JSON.stringify(value)}`,
        );
      }
    }
    if (!changes.length) return 'Já estava assim: nada mudou.';
    if (!input.confirm) {
      return `Isto muda:\n${changes.join('\n')}\nConfirma com ele e volta a chamar com confirm: true.`;
    }
    await client.setConfig(Number(config.id), input.changes);
    return `Mudei:\n${changes.join('\n')}\nPara desfazer, volta a pôr os valores da esquerda.`;
  });
}
