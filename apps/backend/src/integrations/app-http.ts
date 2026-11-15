import { Agent } from 'https';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { AppIntegrationError } from './app-integration.error';

/**
 * Um cliente axios para uma app da LAN (certificados self-signed aceites) cujos
 * erros já saem explicados: 401 = credenciais, 403 = falta de permissão, o
 * resto = inacessível.
 */
export function createAppHttp(
  appName: string,
  baseUrl: string,
  config: AxiosRequestConfig = {},
) {
  const http: AxiosInstance = axios.create({
    baseURL: baseUrl.replace(/\/+$/, ''),
    httpsAgent: new Agent({ rejectUnauthorized: false }),
    timeout: 15_000,
    ...config,
  });

  return async function request<T>(
    path: string,
    options: AxiosRequestConfig = {},
  ): Promise<{ data: T; headers: Record<string, unknown> }> {
    try {
      const response = await http.request<T>({ url: path, ...options });
      return { data: response.data, headers: response.headers };
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : null;
      if (status === 401) {
        throw new AppIntegrationError(
          'APP_AUTH_FAILED',
          `O ${appName} recusou a chave/token.`,
        );
      }
      if (status === 403) {
        throw new AppIntegrationError(
          'APP_AUTH_FAILED',
          `A chave do ${appName} não tem permissão para ${path}.`,
        );
      }
      const detail = axios.isAxiosError(error)
        ? error.response
          ? `respondeu ${error.response.status} em ${path}`
          : error.message
        : String(error);
      throw new AppIntegrationError(
        'APP_UNREACHABLE',
        `Não foi possível falar com o ${appName}: ${detail}`,
      );
    }
  };
}
