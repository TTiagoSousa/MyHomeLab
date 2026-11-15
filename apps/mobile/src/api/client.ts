export const NETWORK_ERROR = 0;

export class ApiError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let serverUrl = '';
let unauthorizedHandler: () => void = () => {};

export const setServerUrl = (url: string) => {
  serverUrl = url.replace(/\/+$/, '');
};

export const onUnauthorized = (handler: () => void) => {
  unauthorizedHandler = handler;
};

export const apiUrl = (path: string) => `${serverUrl}/api${path}`;

const messageOf = (raw: unknown): string | null => {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.filter((item) => typeof item === 'string').join('\n');
  if (raw && typeof raw === 'object' && 'message' in raw) return messageOf((raw as { message: unknown }).message);
  return null;
};

const codeOf = (body: Record<string, unknown>): string | null => {
  if (typeof body.code === 'string') return body.code;
  const nested = body.message;
  if (nested && typeof nested === 'object' && 'code' in nested) {
    const code = (nested as { code: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
};

export async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = 30_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      credentials: 'include',
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    throw new ApiError(NETWORK_ERROR, error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/login')) unauthorizedHandler();
    const json = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    throw new ApiError(response.status, messageOf(json.message) ?? '', codeOf(json));
  }
  return parsed as T;
}
