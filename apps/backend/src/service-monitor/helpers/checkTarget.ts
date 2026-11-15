import { Agent } from 'https';
import { Socket } from 'net';
import axios from 'axios';
import { MonitorKind } from 'src/generated/prisma/client/client';

const TIMEOUT_MS = 10_000;

export interface CheckResult {
  up: boolean;
  latencyMs: number | null;
  error: string | null;
}

/**
 * HTTP: qualquer resposta abaixo de 500 conta como "de pé" — um 401 ou um 302
 * para o login quer dizer que o serviço está a responder. axios e não fetch: o
 * undici falha a ligar-se a serviços da LAN aqui (ver serverStatus.ts).
 */
async function checkHttp(url: string): Promise<CheckResult> {
  const started = Date.now();
  try {
    const response = await axios.get(url, {
      timeout: TIMEOUT_MS,
      maxRedirects: 5,
      httpsAgent: new Agent({ rejectUnauthorized: false }),
      validateStatus: () => true,
      responseType: 'stream',
    });
    (response.data as { destroy?: () => void }).destroy?.();
    const latencyMs = Date.now() - started;
    return response.status < 500
      ? { up: true, latencyMs, error: null }
      : { up: false, latencyMs, error: `Respondeu com ${response.status}` };
  } catch (error) {
    const message =
      axios.isAxiosError(error) && error.code === 'ECONNABORTED'
        ? `Não respondeu em ${TIMEOUT_MS / 1000} s`
        : error instanceof Error
          ? error.message
          : String(error);
    return { up: false, latencyMs: null, error: message };
  }
}

/** TCP: só tenta abrir a ligação a host:porta (DNS, SSH, bases de dados…). */
function checkTcp(target: string): Promise<CheckResult> {
  const match = target.trim().match(/^\[?([^\]]+?)\]?:(\d+)$/);
  if (!match) {
    return Promise.resolve({
      up: false,
      latencyMs: null,
      error: 'Formato host:porta inválido',
    });
  }
  const [, host, port] = match;

  return new Promise((resolve) => {
    const started = Date.now();
    const socket = new Socket();
    const finish = (result: CheckResult) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(TIMEOUT_MS);
    socket.once('connect', () =>
      finish({ up: true, latencyMs: Date.now() - started, error: null }),
    );
    socket.once('timeout', () =>
      finish({
        up: false,
        latencyMs: null,
        error: `Não respondeu em ${TIMEOUT_MS / 1000} s`,
      }),
    );
    socket.once('error', (error) =>
      finish({ up: false, latencyMs: null, error: error.message }),
    );
    socket.connect(Number(port), host);
  });
}

export function checkTarget(
  kind: MonitorKind,
  target: string,
): Promise<CheckResult> {
  return kind === MonitorKind.TCP ? checkTcp(target) : checkHttp(target);
}
