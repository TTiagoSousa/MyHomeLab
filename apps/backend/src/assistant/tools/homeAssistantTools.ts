import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import {
  HaConfigKind,
  HaState,
  HomeAssistantClient,
  createHomeAssistantClient,
} from 'src/home-assistant/home-assistant.client';
import {
  HA_UPDATE_GROUPS,
  HaUpdateGroup,
  haUpdates,
} from 'src/home-assistant/helpers/haUpdates';
import { lisbonStamp } from 'src/utils/lisbonTime';

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const domainOf = (entityId: string) => entityId.split('.')[0];

const friendlyName = (state: HaState) =>
  typeof state.attributes.friendly_name === 'string'
    ? state.attributes.friendly_name
    : state.entity_id;

const json = (value: unknown, max = 6000) => {
  const text = JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n… (cortado)` : text;
};

const accountLabel = (account: ConnectedAccount) =>
  `${account.displayName ?? 'Home Assistant'} (${account.baseUrl ? new URL(account.baseUrl).host : '?'})`;

export interface HomeAssistantTarget {
  account: ConnectedAccount;
  client: HomeAssistantClient;
}

/**
 * O Home Assistant a usar: o único, ou o que bate com o nome ou o endereço que
 * o agente passou. Devolve uma frase para o agente quando não dá.
 */
export async function homeAssistantTarget(
  repository: PrismaConnectedAccountRepository,
  userId: string,
  wanted?: string,
): Promise<HomeAssistantTarget | string> {
  const accounts = (
    await repository.findAllByUser(userId, ConnectionProvider.HOME_ASSISTANT)
  ).filter(
    (account) => account.isActive && account.accessToken && account.baseUrl,
  );
  if (!accounts.length) {
    return 'Não há nenhum Home Assistant ligado. Liga-o em Apps ligadas → Home Assistant.';
  }
  const matches = wanted?.trim()
    ? accounts.filter((account) =>
        normalize(accountLabel(account)).includes(normalize(wanted)),
      )
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o Home Assistant: ${accounts.map(accountLabel).join(', ')}.`;
  }
  const account = matches[0];
  return {
    account,
    client: createHomeAssistantClient(account.baseUrl!, account.accessToken!),
  };
}

/** Estados e registos juntos: a área de uma entidade é a dela ou a do dispositivo. */
async function snapshot(target: HomeAssistantTarget) {
  const [states, registries] = await Promise.all([
    target.client.states(),
    target.client.registries(),
  ]);
  const entries = new Map(
    registries.entities.map((entry) => [entry.entity_id, entry]),
  );
  const devices = new Map(
    registries.devices.map((device) => [device.id, device]),
  );
  const areas = new Map(registries.areas.map((area) => [area.area_id, area]));
  const areaOf = (entityId: string) => {
    const entry = entries.get(entityId);
    const areaId =
      entry?.area_id ??
      (entry?.device_id ? devices.get(entry.device_id)?.area_id : null);
    return areaId ? (areas.get(areaId) ?? null) : null;
  };
  return { states, registries, entries, devices, areas, areaOf };
}

/** Uma área pelo id ou pelo nome (sem ligar a acentos nem maiúsculas). */
const findArea = (areas: { area_id: string; name: string }[], wanted: string) =>
  areas.find(
    (area) =>
      area.area_id === wanted || normalize(area.name) === normalize(wanted),
  );

export async function overview(target: HomeAssistantTarget): Promise<string> {
  const [config, data] = await Promise.all([
    target.client.config(),
    snapshot(target),
  ]);
  const byDomain = new Map<string, number>();
  for (const state of data.states) {
    const domain = domainOf(state.entity_id);
    byDomain.set(domain, (byDomain.get(domain) ?? 0) + 1);
  }
  const byArea = new Map<string, number>();
  for (const state of data.states) {
    const area = data.areaOf(state.entity_id);
    if (area) byArea.set(area.name, (byArea.get(area.name) ?? 0) + 1);
  }
  const updates = data.states.filter(
    (state) => domainOf(state.entity_id) === 'update' && state.state === 'on',
  );
  return [
    `${config.location_name ?? 'Home Assistant'} — versão ${config.version}, fuso ${config.time_zone ?? '?'}.`,
    `${data.states.length} entidades, ${data.registries.devices.length} dispositivos, ${data.registries.areas.length} áreas.`,
    `Por domínio: ${[...byDomain.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([domain, count]) => `${domain} ${count}`)
      .join(', ')}.`,
    `Áreas: ${
      data.registries.areas
        .map(
          (area) =>
            `${area.name} [${area.area_id}] (${byArea.get(area.name) ?? 0})`,
        )
        .join(', ') || 'nenhuma'
    }.`,
    updates.length
      ? `Atualizações por instalar: ${updates.map(friendlyName).join(', ')}.`
      : 'Sem atualizações por instalar.',
  ].join('\n');
}

/** As atualizações dentro do Home Assistant, separadas por grupo. */
export async function listUpdates(
  target: HomeAssistantTarget,
  all = false,
): Promise<string> {
  const [states, registries] = await Promise.all([
    target.client.states(),
    target.client.registries(),
  ]);
  const items = haUpdates(states, registries.entities).filter(
    (item) => all || item.pending || item.inProgress,
  );
  if (!items.length) {
    return all
      ? 'Este Home Assistant não tem entidades de atualização.'
      : 'Nada por atualizar dentro do Home Assistant.';
  }
  return (Object.keys(HA_UPDATE_GROUPS) as HaUpdateGroup[])
    .map((group) => {
      const inGroup = items.filter((item) => item.group === group);
      if (!inGroup.length) return null;
      return (
        `${HA_UPDATE_GROUPS[group]} (${inGroup.length}):\n` +
        inGroup
          .map(
            (item) =>
              `· ${item.title} [${item.entityId}] ${item.installed ?? '?'} → ${item.latest ?? '?'}` +
              (item.inProgress ? ' · a instalar' : '') +
              (item.skipped ? ` · saltada a ${item.skipped}` : '') +
              (item.autoUpdate ? ' · atualiza sozinha' : '') +
              (item.releaseUrl ? ` · ${item.releaseUrl}` : '') +
              (item.releaseSummary
                ? `\n  ${item.releaseSummary.slice(0, 300)}`
                : ''),
          )
          .join('\n')
      );
    })
    .filter(Boolean)
    .join('\n\n');
}

export async function listEntities(
  target: HomeAssistantTarget,
  input: { domain?: string; area?: string; search?: string; limit?: number },
): Promise<string> {
  const data = await snapshot(target);
  const area = input.area?.trim()
    ? findArea(data.registries.areas, input.area)
    : undefined;
  if (input.area?.trim() && !area) {
    return `Não há nenhuma área "${input.area}". Existem: ${data.registries.areas.map((item) => item.name).join(', ')}.`;
  }
  const search = input.search?.trim() ? normalize(input.search) : '';
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 300);
  const found = data.states.filter(
    (state) =>
      (!input.domain || domainOf(state.entity_id) === input.domain.trim()) &&
      (!area || data.areaOf(state.entity_id)?.area_id === area.area_id) &&
      (!search ||
        normalize(`${state.entity_id} ${friendlyName(state)}`).includes(
          search,
        )),
  );
  if (!found.length) return 'Nenhuma entidade corresponde.';
  const lines = found.slice(0, limit).map((state) => {
    const entry = data.entries.get(state.entity_id);
    const unit = state.attributes.unit_of_measurement;
    const flags = [
      data.areaOf(state.entity_id)?.name,
      entry?.disabled_by ? 'desativada' : null,
      entry?.hidden_by ? 'oculta' : null,
    ].filter(Boolean);
    return (
      `${state.entity_id} "${friendlyName(state)}" = ${state.state}${typeof unit === 'string' ? ` ${unit}` : ''}` +
      (flags.length ? ` (${flags.join(', ')})` : '')
    );
  });
  return (
    lines.join('\n') +
    (found.length > limit
      ? `\n… e mais ${found.length - limit}. Filtra por domínio, área ou texto.`
      : '')
  );
}

export async function getEntity(
  target: HomeAssistantTarget,
  input: { entity_id: string },
): Promise<string> {
  const entityId = input.entity_id.trim();
  const [state, data] = await Promise.all([
    target.client.state(entityId),
    snapshot(target),
  ]);
  const entry = data.entries.get(entityId);
  const device = entry?.device_id ? data.devices.get(entry.device_id) : null;
  return [
    `${entityId} "${friendlyName(state)}" = ${state.state} (desde ${lisbonStamp(state.last_changed)})`,
    entry
      ? `Registo: nome ${entry.name ? `"${entry.name}"` : `de origem "${entry.original_name ?? '—'}"`}, ícone ${entry.icon ?? 'por omissão'}, ` +
        `área ${data.areaOf(entityId)?.name ?? 'nenhuma'}${entry.area_id ? '' : ' (do dispositivo)'}, integração ${entry.platform}` +
        `${entry.disabled_by ? `, desativada (${entry.disabled_by})` : ''}${entry.hidden_by ? `, oculta (${entry.hidden_by})` : ''}.`
      : 'Sem registo (não tem unique_id): não se pode mudar o nome, a área nem o id por aqui.',
    device
      ? `Dispositivo: ${device.name_by_user ?? device.name ?? '?'}${device.manufacturer ? `, ${device.manufacturer}` : ''}${device.model ? ` ${device.model}` : ''}.`
      : '',
    `Atributos:\n${json(state.attributes, 4000)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function listServices(
  target: HomeAssistantTarget,
  input: { domain: string },
): Promise<string> {
  const domains = await target.client.services();
  const domain = domains.find((item) => item.domain === input.domain.trim());
  if (!domain) {
    return `Não há o domínio "${input.domain}". Existem: ${domains.map((item) => item.domain).join(', ')}.`;
  }
  return Object.entries(domain.services)
    .map(([name, service]) => {
      const fields = Object.entries(service.fields ?? {})
        .map(
          ([field, info]) =>
            `${field}${info.required ? ' (obrigatório)' : ''}${info.description ? `: ${info.description}` : ''}`,
        )
        .join('; ');
      return `${domain.domain}.${name}${service.description ? ` — ${service.description}` : ''}${fields ? `\n  campos: ${fields}` : ''}`;
    })
    .join('\n');
}

export async function callService(
  target: HomeAssistantTarget,
  input: {
    domain: string;
    service: string;
    entity_id?: string | string[];
    data?: Record<string, unknown>;
    return_response?: boolean;
  },
): Promise<string> {
  const data = {
    ...(input.data ?? {}),
    ...(input.entity_id ? { entity_id: input.entity_id } : {}),
  };
  const result = await target.client.callService(
    input.domain.trim(),
    input.service.trim(),
    data,
    Boolean(input.return_response),
  );
  const call = `${input.domain}.${input.service}`;
  if (input.return_response) {
    const response =
      typeof result === 'object' && result && 'service_response' in result
        ? result.service_response
        : result;
    return `${call} feito. Resposta:\n${json(response)}`;
  }
  const changed = Array.isArray(result) ? (result as HaState[]) : [];
  return changed.length
    ? `${call} feito. Mudou: ${changed.map((state) => `${state.entity_id} = ${state.state}`).join(', ')}.`
    : `${call} feito (nenhuma entidade mudou de estado logo a seguir).`;
}

const KIND_LABEL: Record<HaConfigKind, string> = {
  automation: 'automações',
  script: 'scripts',
  scene: 'cenas',
};

/** O id da configuração: nas automações e cenas vem no atributo id; nos scripts é o nome da entidade. */
const configIdOf = (kind: HaConfigKind, state: HaState) =>
  kind === 'script'
    ? state.entity_id.replace(/^script\./, '')
    : typeof state.attributes.id === 'string'
      ? state.attributes.id
      : null;

export async function listConfigs(
  target: HomeAssistantTarget,
  input: { kind: HaConfigKind; search?: string },
): Promise<string> {
  const search = input.search?.trim() ? normalize(input.search) : '';
  const states = (await target.client.states()).filter(
    (state) =>
      domainOf(state.entity_id) === input.kind &&
      (!search ||
        normalize(`${state.entity_id} ${friendlyName(state)}`).includes(
          search,
        )),
  );
  if (!states.length) return `Não há ${KIND_LABEL[input.kind]}.`;
  return states
    .map((state) => {
      const id = configIdOf(input.kind, state);
      const last = state.attributes.last_triggered;
      return (
        `${state.entity_id} "${friendlyName(state)}" — ${state.state}` +
        (id ? `, id ${id}` : ', sem id (vem do YAML, não se edita por aqui)') +
        (typeof last === 'string' ? `, última vez ${lisbonStamp(last)}` : '')
      );
    })
    .join('\n');
}

export async function getConfig(
  target: HomeAssistantTarget,
  input: { kind: HaConfigKind; id: string },
): Promise<string> {
  const config = await target.client.getConfig(input.kind, input.id.trim());
  return json(config, 12000);
}

const slug = (text: string) =>
  normalize(text)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `script_${Date.now()}`;

export async function saveConfig(
  target: HomeAssistantTarget,
  input: { kind: HaConfigKind; id?: string; config: Record<string, unknown> },
): Promise<string> {
  const alias =
    typeof input.config.alias === 'string' ? input.config.alias : '';
  const id =
    input.id?.trim() ||
    (input.kind === 'script' ? slug(alias) : String(Date.now()));

  const previous = input.id?.trim()
    ? await target.client.getConfig(input.kind, id).catch(() => null)
    : null;
  await target.client.saveConfig(input.kind, id, input.config);

  const [what, done] = {
    automation: ['A automação', previous ? 'alterada' : 'criada'],
    script: ['O script', previous ? 'alterado' : 'criado'],
    scene: ['A cena', previous ? 'alterada' : 'criada'],
  }[input.kind];
  return [
    `${what} "${alias || id}" ficou ${done} (id ${id}${input.kind === 'script' ? `, entidade script.${id}` : ''}). O Home Assistant validou e recarregou.`,
    previous
      ? `Configuração anterior (para desfazer, grava-a de volta):\n${json(previous, 6000)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function deleteConfig(
  target: HomeAssistantTarget,
  input: { kind: HaConfigKind; id: string },
): Promise<string> {
  const id = input.id.trim();
  const previous = await target.client.getConfig(input.kind, id);
  await target.client.deleteConfig(input.kind, id);
  return `Apagado (${input.kind} ${id}). Era assim, se for preciso recriar:\n${json(previous, 6000)}`;
}

export async function updateEntity(
  target: HomeAssistantTarget,
  input: {
    entity_id: string;
    name?: string | null;
    icon?: string | null;
    area?: string | null;
    new_entity_id?: string;
    enabled?: boolean;
    visible?: boolean;
  },
): Promise<string> {
  const changes: Record<string, unknown> = {};
  if (input.name !== undefined) changes.name = input.name?.trim() || null;
  if (input.icon !== undefined) changes.icon = input.icon?.trim() || null;
  if (input.new_entity_id?.trim()) {
    changes.new_entity_id = input.new_entity_id.trim();
  }
  if (input.enabled !== undefined) {
    changes.disabled_by = input.enabled ? null : 'user';
  }
  if (input.visible !== undefined) {
    changes.hidden_by = input.visible ? null : 'user';
  }
  if (input.area !== undefined) {
    if (!input.area?.trim()) {
      changes.area_id = null;
    } else {
      const { areas } = await target.client.registries();
      const area = findArea(areas, input.area);
      if (!area) {
        return `Não há nenhuma área "${input.area}". Existem: ${areas.map((item) => item.name).join(', ')}.`;
      }
      changes.area_id = area.area_id;
    }
  }
  if (!Object.keys(changes).length) return 'Não pediste nenhuma alteração.';

  const entry = await target.client.updateEntity(
    input.entity_id.trim(),
    changes,
  );
  return (
    `${entry.entity_id} atualizada: nome ${entry.name ? `"${entry.name}"` : 'de origem'}, ícone ${entry.icon ?? 'por omissão'}, ` +
    `área ${entry.area_id ?? 'a do dispositivo'}${entry.disabled_by ? ', desativada' : ''}${entry.hidden_by ? ', oculta' : ''}.` +
    (changes.new_entity_id
      ? ' Atenção: automações, scripts e painéis que usavam o id antigo têm de ser atualizados.'
      : '')
  );
}

export async function systemLog(
  target: HomeAssistantTarget,
  input: { limit?: number },
): Promise<string> {
  const entries = (await target.client.systemLog())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, Math.min(Math.max(input.limit ?? 20, 1), 50));
  if (!entries.length)
    return 'O registo do Home Assistant não tem erros nem avisos.';
  return entries
    .map(
      (entry) =>
        `${lisbonStamp(entry.timestamp)} ${entry.level} ${entry.name}` +
        `${entry.count > 1 ? ` (${entry.count}×)` : ''}: ${entry.message.join(' | ').slice(0, 500)}`,
    )
    .join('\n');
}
