import WebSocket from 'ws';
import { AppIntegrationError } from 'src/integrations/app-integration.error';

export interface HaSocketCommand {
  type: string;
  [key: string]: unknown;
}

interface HaSocketMessage {
  id?: number;
  type: string;
  success?: boolean;
  result?: unknown;
  error?: { code?: string; message?: string };
}

const TIMEOUT_MS = 30_000;

const socketUrl = (baseUrl: string) =>
  `${baseUrl.replace(/\/+$/, '').replace(/^http/i, 'ws')}/api/websocket`;

function commandError(type: string, error: HaSocketMessage['error']) {
  if (error?.code === 'unauthorized') {
    return new AppIntegrationError(
      'APP_AUTH_FAILED',
      `O token do Home Assistant não é de um administrador — ${type} precisa de um token de admin.`,
    );
  }
  if (error?.code === 'unknown_command') {
    return new AppIntegrationError(
      'APP_NOT_SUPPORTED',
      `Este Home Assistant não conhece o comando ${type} (pode ser antigo demais).`,
    );
  }
  return new AppIntegrationError(
    'APP_UNREACHABLE',
    `O Home Assistant recusou ${type}: ${error?.message ?? error?.code ?? 'erro desconhecido'}`,
  );
}

/**
 * A API WebSocket do Home Assistant (`/api/websocket`): abre a ligação, faz a
 * autenticação com o token de longa duração, corre os comandos por ordem e
 * fecha. Devolve o `result` de cada comando. Os registos (entidades, áreas,
 * dispositivos) e os backups só existem por aqui — a API REST não os mostra.
 */
export function haSocketCommands(
  baseUrl: string,
  token: string,
  commands: HaSocketCommand[],
): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const results: unknown[] = [];
    let settled = false;
    const socket = new WebSocket(socketUrl(baseUrl), {
      rejectUnauthorized: false,
      handshakeTimeout: 10_000,
      maxPayload: 256 * 1024 * 1024,
    });

    const finish = (error: Error | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      if (error) reject(error);
      else resolve(results);
    };

    const timer = setTimeout(
      () =>
        finish(
          new AppIntegrationError(
            'APP_UNREACHABLE',
            'O Home Assistant não respondeu a tempo.',
          ),
        ),
      TIMEOUT_MS,
    );

    const sendNext = () => {
      const next = commands[results.length];
      if (!next) return finish(null);
      socket.send(JSON.stringify({ ...next, id: results.length + 1 }));
    };

    socket.on('message', (raw) => {
      let message: HaSocketMessage;
      try {
        const text = Array.isArray(raw)
          ? Buffer.concat(raw).toString('utf8')
          : Buffer.from(raw as ArrayBuffer).toString('utf8');
        message = JSON.parse(text) as HaSocketMessage;
      } catch {
        return;
      }

      if (message.type === 'auth_required') {
        socket.send(JSON.stringify({ type: 'auth', access_token: token }));
      } else if (message.type === 'auth_invalid') {
        finish(
          new AppIntegrationError(
            'APP_AUTH_FAILED',
            'O Home Assistant recusou o token.',
          ),
        );
      } else if (message.type === 'auth_ok') {
        sendNext();
      } else if (
        message.type === 'result' &&
        message.id === results.length + 1
      ) {
        const command = commands[results.length];
        if (!message.success) {
          return finish(commandError(command.type, message.error));
        }
        results.push(message.result);
        sendNext();
      }
    });

    socket.on('error', (error) =>
      finish(
        new AppIntegrationError(
          'APP_UNREACHABLE',
          `Não foi possível falar com o Home Assistant: ${error.message}`,
        ),
      ),
    );

    socket.on('close', () =>
      finish(
        new AppIntegrationError(
          'APP_UNREACHABLE',
          'O Home Assistant fechou a ligação.',
        ),
      ),
    );
  });
}
