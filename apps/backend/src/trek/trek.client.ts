import { Agent } from 'https';
import { Readable } from 'stream';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

/** A parte de /api/auth/app-config que interessa (é pública — o ecrã de login usa-a). */
export interface TrekAppConfig {
  version?: string;
  has_users?: boolean;
  allow_registration?: boolean;
  password_registration?: boolean;
  oidc_registration?: boolean;
  password_login?: boolean;
  oidc_login?: boolean;
  oidc_configured?: boolean;
  passkey_configured?: boolean;
  require_mfa?: boolean;
  demo_mode?: boolean;
  dev_mode?: boolean;
  timezone?: string;
  available_channels?: Record<string, boolean>;
}

/** "https://trek.exemplo.com/" → "https://trek.exemplo.com". */
export const normalizeTrekUrl = (url: string) => url.trim().replace(/\/+$/, '');

/** O repositório das releases do TREK (antes mauriceboe/TREK). */
export const TREK_REPOSITORY = 'liketrek/TREK';

/**
 * O TREK (planeador de viagens) diz a versão e como está configurado no
 * /api/auth/app-config, sem sessão — não é preciso guardar credenciais.
 */
export async function fetchTrekAppConfig(
  baseUrl: string,
): Promise<TrekAppConfig> {
  const url = `${baseUrl.replace(/\/+$/, '')}/api/auth/app-config`;
  try {
    const response = await axios.get<TrekAppConfig>(url, {
      httpsAgent: new Agent({ rejectUnauthorized: false }),
      timeout: 15_000,
    });
    if (typeof response.data !== 'object' || !response.data?.version) {
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        'Este endereço não parece ser um TREK (não devolveu a versão em /api/auth/app-config).',
      );
    }
    return response.data;
  } catch (error) {
    if (error instanceof AppIntegrationError) throw error;
    const detail = axios.isAxiosError(error)
      ? error.response
        ? `respondeu ${error.response.status} em /api/auth/app-config`
        : error.message
      : String(error);
    throw new AppIntegrationError(
      'APP_UNREACHABLE',
      `Não foi possível falar com o TREK: ${detail}`,
    );
  }
}

/** Um backup guardado no TREK (Admin → Backup). */
export interface TrekRawBackup {
  filename: string;
  size: number;
  created_at: string;
}

/** O backup automático do TREK: `keep_days` 0 = nunca apaga. */
export interface TrekAutoBackupSettings {
  enabled: boolean;
  interval: 'hourly' | 'daily' | 'weekly' | 'monthly';
  keep_days: number;
  hour: number;
  day_of_week: number;
  day_of_month: number;
}

interface TrekLoginResponse {
  token?: string;
  mfa_required?: boolean;
  user?: { role?: string };
}

/** O TREK só deixa fazer 3 backups por hora (por IP). */
export class TrekRateLimitError extends AppIntegrationError {}

/** As sessões abertas no TREK, por endereço + email, para não fazer login a cada pedido. */
const trekSessions = new Map<string, string>();

const trekErrorText = (error: unknown) => {
  if (!axios.isAxiosError(error)) return String(error);
  const body = error.response?.data as { error?: string } | undefined;
  if (body?.error) return body.error;
  return error.response ? `respondeu ${error.response.status}` : error.message;
};

/**
 * A parte de admin do TREK, com um email e password de administrador (o TREK
 * não tem tokens de API: entra-se como no ecrã de login e usa-se o token da
 * sessão como Bearer). A sessão fica guardada em memória e repete-se o login
 * quando expira. Contas com MFA não servem — não há como dar o código.
 */
export function createTrekAdminClient(
  baseUrl: string,
  email: string,
  password: string,
) {
  const root = baseUrl.replace(/\/+$/, '');
  const sessionKey = `${root}|${email.toLowerCase()}`;
  const http = axios.create({
    baseURL: root,
    httpsAgent: new Agent({ rejectUnauthorized: false }),
    timeout: 30_000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  async function login(): Promise<string> {
    let data: TrekLoginResponse;
    try {
      const response = await http.post<TrekLoginResponse>('/api/auth/login', {
        email,
        password,
        remember_me: true,
      });
      data = response.data;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : null;
      if (status === 401 || status === 400) {
        throw new AppIntegrationError(
          'APP_AUTH_FAILED',
          'O TREK recusou o email ou a password.',
        );
      }
      if (status === 429) {
        throw new AppIntegrationError(
          'APP_UNREACHABLE',
          'O TREK bloqueou o login por demasiadas tentativas. Tenta daqui a uns minutos.',
        );
      }
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        `Não foi possível entrar no TREK: ${trekErrorText(error)}`,
      );
    }
    if (data?.mfa_required) {
      throw new AppIntegrationError(
        'APP_AUTH_FAILED',
        'Esta conta do TREK tem MFA ligado. Usa um administrador só para o MyHomeLab, sem MFA.',
      );
    }
    if (!data?.token) {
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        'O TREK não devolveu a sessão no login.',
      );
    }
    if (data.user?.role && data.user.role !== 'admin') {
      throw new AppIntegrationError(
        'APP_AUTH_FAILED',
        'Esta conta do TREK não é administradora — os backups só se gerem com um admin.',
      );
    }
    trekSessions.set(sessionKey, data.token);
    return data.token;
  }

  /** Faz o pedido com a sessão guardada; se ela tiver expirado, entra outra vez e repete. */
  async function request<T>(
    config: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    const send = (token: string) =>
      http.request<T>({
        ...config,
        headers: { ...config.headers, Authorization: `Bearer ${token}` },
      });
    try {
      try {
        return await send(trekSessions.get(sessionKey) ?? (await login()));
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          trekSessions.delete(sessionKey);
          return await send(await login());
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof AppIntegrationError) throw error;
      const status = axios.isAxiosError(error) ? error.response?.status : null;
      const code = axios.isAxiosError(error)
        ? (error.response?.data as { code?: string } | undefined)?.code
        : undefined;
      if (status === 403 && code === 'MFA_REQUIRED') {
        throw new AppIntegrationError(
          'APP_AUTH_FAILED',
          'O TREK obriga a MFA e esta conta não o tem configurado. Usa um administrador sem essa obrigação.',
        );
      }
      if (status === 403) {
        throw new AppIntegrationError(
          'APP_NOT_SUPPORTED',
          `O TREK não deixou fazer isto: ${trekErrorText(error)}`,
        );
      }
      if (status === 429) {
        throw new TrekRateLimitError(
          'APP_UNREACHABLE',
          'O TREK só deixa fazer 3 backups por hora. Tenta mais tarde.',
        );
      }
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        `Não foi possível falar com o TREK: ${trekErrorText(error)}`,
      );
    }
  }

  const fileUrl = (filename: string) =>
    `/api/backup/${encodeURIComponent(filename)}`;

  return {
    /** Confirma que entra e que a conta é admin. */
    async assertAdmin() {
      trekSessions.delete(sessionKey);
      await login();
      await request({ method: 'GET', url: '/api/backup/auto-settings' });
    },

    async listBackups(): Promise<TrekRawBackup[]> {
      const response = await request<{ backups?: TrekRawBackup[] }>({
        method: 'GET',
        url: '/api/backup/list',
      });
      return response.data?.backups ?? [];
    },

    async autoSettings() {
      const response = await request<{
        settings: TrekAutoBackupSettings;
        timezone?: string;
      }>({ method: 'GET', url: '/api/backup/auto-settings' });
      return response.data;
    },

    async updateAutoSettings(settings: TrekAutoBackupSettings) {
      const response = await request<{ settings: TrekAutoBackupSettings }>({
        method: 'PUT',
        url: '/api/backup/auto-settings',
        data: settings,
      });
      return response.data.settings;
    },

    async createBackup(): Promise<TrekRawBackup> {
      const response = await request<{ backup: TrekRawBackup }>({
        method: 'POST',
        url: '/api/backup/create',
        timeout: 0,
      });
      return response.data.backup;
    },

    async deleteBackup(filename: string) {
      await request({ method: 'DELETE', url: fileUrl(filename) });
    },

    /** O zip em stream, sem o carregar todo para a memória. */
    async downloadBackup(filename: string) {
      const response = await request<Readable>({
        method: 'GET',
        url: `/api/backup/download/${encodeURIComponent(filename)}`,
        responseType: 'stream',
        timeout: 0,
      });
      const length = Number(response.headers['content-length']);
      return {
        stream: response.data,
        size: Number.isFinite(length) && length > 0 ? length : null,
      };
    },
  };
}

export type TrekAdminClient = ReturnType<typeof createTrekAdminClient>;
