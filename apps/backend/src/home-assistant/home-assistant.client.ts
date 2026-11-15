import { Agent } from 'https';
import { Readable } from 'stream';
import axios, { AxiosInstance } from 'axios';
import { AppIntegrationError } from 'src/integrations/app-integration.error';
import { haSocketCommands, HaSocketCommand } from './home-assistant.socket';

/** O repositório das releases do Home Assistant (a versão do Core). */
export const HOME_ASSISTANT_REPOSITORY = 'home-assistant/core';

/** "http://ha.lan:8123/" → "http://ha.lan:8123". */
export const normalizeHomeAssistantUrl = (url: string) =>
  url.trim().replace(/\/+$/, '');

/** O que se edita como configuração: cada um vive no seu ficheiro YAML do HA. */
export type HaConfigKind = 'automation' | 'script' | 'scene';

export interface HaConfig {
  version: string;
  location_name?: string;
  time_zone?: string;
  components?: string[];
}

export interface HaState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface HaServiceDomain {
  domain: string;
  services: Record<
    string,
    {
      name?: string;
      description?: string;
      fields?: Record<
        string,
        { name?: string; description?: string; required?: boolean }
      >;
    }
  >;
}

export interface HaUser {
  id: string;
  name: string;
  is_owner: boolean;
  is_admin: boolean;
}

export interface HaEntityEntry {
  entity_id: string;
  unique_id?: string;
  name: string | null;
  original_name?: string | null;
  icon: string | null;
  platform: string;
  area_id: string | null;
  device_id: string | null;
  disabled_by: string | null;
  hidden_by: string | null;
  entity_category: string | null;
}

export interface HaArea {
  area_id: string;
  name: string;
  floor_id?: string | null;
}

export interface HaDevice {
  id: string;
  name: string | null;
  name_by_user: string | null;
  manufacturer: string | null;
  model: string | null;
  area_id: string | null;
  disabled_by: string | null;
}

/** O que o HA diz quando recusa um pedido: o `message` do corpo, se o houver. */
const haMessage = (data: unknown) =>
  typeof data === 'object' && data && 'message' in data
    ? String(data.message)
    : typeof data === 'string' && data.length < 300
      ? data
      : '';

/**
 * O Home Assistant com um token de acesso de longa duração: a REST API
 * (`/api/...`) para estados, serviços e as configurações das automações,
 * scripts e cenas, e a WebSocket para os registos e os backups.
 */
export function createHomeAssistantClient(baseUrl: string, token: string) {
  const http: AxiosInstance = axios.create({
    baseURL: `${normalizeHomeAssistantUrl(baseUrl)}/api`,
    headers: { Authorization: `Bearer ${token}` },
    httpsAgent: new Agent({ rejectUnauthorized: false }),
    timeout: 20_000,
  });

  async function request<T>(
    method: 'get' | 'post' | 'delete',
    path: string,
    body?: unknown,
  ): Promise<T> {
    try {
      const response = await http.request<T>({ method, url: path, data: body });
      return response.data;
    } catch (error) {
      if (!axios.isAxiosError(error) || !error.response) {
        throw new AppIntegrationError(
          'APP_UNREACHABLE',
          `Não foi possível falar com o Home Assistant: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      const status = error.response.status;
      const data: unknown = error.response.data;
      if (status === 401 || status === 403) {
        throw new AppIntegrationError(
          'APP_AUTH_FAILED',
          status === 401
            ? 'O Home Assistant recusou o token.'
            : `O token do Home Assistant não pode fazer isto (${path}) — precisa de ser de um administrador.`,
        );
      }
      const detail = haMessage(data);
      throw new AppIntegrationError(
        status >= 500 ? 'APP_UNREACHABLE' : 'APP_NOT_SUPPORTED',
        `O Home Assistant respondeu ${status} em ${path}${detail ? `: ${detail}` : ''}`,
      );
    }
  }

  const socket = (commands: HaSocketCommand[]) =>
    haSocketCommands(baseUrl, token, commands);

  const configPath = (kind: HaConfigKind, id: string) =>
    `/config/${kind}/config/${encodeURIComponent(id)}`;

  return {
    config: () => request<HaConfig>('get', '/config'),
    states: () => request<HaState[]>('get', '/states'),
    state: (entityId: string) =>
      request<HaState>('get', `/states/${encodeURIComponent(entityId)}`),
    services: () => request<HaServiceDomain[]>('get', '/services'),
    callService: (
      domain: string,
      service: string,
      data: Record<string, unknown>,
      returnResponse: boolean,
    ) =>
      request<unknown>(
        'post',
        `/services/${encodeURIComponent(domain)}/${encodeURIComponent(service)}${returnResponse ? '?return_response' : ''}`,
        data,
      ),
    getConfig: (kind: HaConfigKind, id: string) =>
      request<Record<string, unknown>>('get', configPath(kind, id)),
    /** Cria ou substitui; o HA valida, grava no YAML e recarrega. */
    saveConfig: (kind: HaConfigKind, id: string, config: unknown) =>
      request<{ result: string }>('post', configPath(kind, id), config),
    deleteConfig: (kind: HaConfigKind, id: string) =>
      request<{ result: string }>('delete', configPath(kind, id)),
    checkConfig: () =>
      request<{ result: 'valid' | 'invalid'; errors: string | null }>(
        'post',
        '/config/core/check_config',
      ),

    socket,
    async currentUser(): Promise<HaUser> {
      const [user] = (await socket([{ type: 'auth/current_user' }])) as [
        HaUser,
      ];
      return user;
    },
    /** A ficha de um add-on no Supervisor (o endereço do repositório, a versão…). */
    async addonInfo(slug: string) {
      const [info] = (await socket([
        {
          type: 'supervisor/api',
          endpoint: `/addons/${encodeURIComponent(slug)}/info`,
          method: 'get',
        },
      ])) as [{ url?: string | null; repository?: string; version?: string }];
      return info;
    },
    async registries() {
      const [entities, areas, devices] = (await socket([
        { type: 'config/entity_registry/list' },
        { type: 'config/area_registry/list' },
        { type: 'config/device_registry/list' },
      ])) as [HaEntityEntry[], HaArea[], HaDevice[]];
      return { entities, areas, devices };
    },
    async updateEntity(entityId: string, changes: Record<string, unknown>) {
      const [result] = (await socket([
        {
          type: 'config/entity_registry/update',
          entity_id: entityId,
          ...changes,
        },
      ])) as [{ entity_entry: HaEntityEntry }];
      return result.entity_entry;
    },
    async systemLog() {
      const [entries] = (await socket([{ type: 'system_log/list' }])) as [
        {
          name: string;
          message: string[];
          level: string;
          source: [string, number];
          timestamp: number;
          count: number;
        }[],
      ];
      return entries;
    },

    /** O ficheiro do backup tal como está guardado (encriptado, se for o caso), em stream. */
    async downloadBackup(backupId: string, agentId: string) {
      try {
        const response = await http.get<Readable>(
          `/backup/download/${encodeURIComponent(backupId)}`,
          { params: { agent_id: agentId }, responseType: 'stream', timeout: 0 },
        );
        return {
          stream: response.data,
          size: response.headers['content-length'] as string | undefined,
        };
      } catch (error) {
        if (
          axios.isAxiosError(error) &&
          (error.response?.status === 401 || error.response?.status === 403)
        ) {
          throw new AppIntegrationError(
            'APP_AUTH_FAILED',
            'O Home Assistant recusou o token — descarregar backups precisa de um token de admin.',
          );
        }
        throw new AppIntegrationError(
          'APP_UNREACHABLE',
          `Não foi possível descarregar o backup do Home Assistant: ${axios.isAxiosError(error) && error.response ? `respondeu ${error.response.status}` : String(error)}`,
        );
      }
    },
  };
}

export type HomeAssistantClient = ReturnType<typeof createHomeAssistantClient>;
