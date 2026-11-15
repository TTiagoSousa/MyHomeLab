import { Client, utils } from 'ssh2';

export interface SshTarget {
  host: string;
  port: number;
  username: string;
  privateKey: string;
}

export interface SshResult {
  exitCode: number | null;
  output: string;
}

export interface SshExecOptions {
  timeoutMs?: number;
  /** O que se escreve no stdin do comando (ex.: um script para `bash -s`). */
  input?: string;
  maxOutput?: number;
}

const MAX_OUTPUT = 30_000;

/** Um par de chaves ed25519 novo, no formato do OpenSSH (a pública vai para o authorized_keys). */
export function generateSshKeys(comment: string) {
  const keys = utils.generateKeyPairSync('ed25519', { comment });
  return { privateKey: keys.private, publicKey: keys.public.trim() };
}

/** Saídas grandes ficam com o princípio e o fim, que é onde costumam estar os erros. */
function trimOutput(text: string, max: number): string {
  if (text.length <= max) return text;
  const half = max / 2;
  return `${text.slice(0, half)}\n… (${text.length - max} caracteres cortados) …\n${text.slice(-half)}`;
}

/**
 * Corre um comando por SSH e devolve o código de saída e o stdout+stderr juntos.
 * Ao fim do tempo, a ligação fecha e o comando conta como falhado. A chave do
 * servidor não é verificada: é a rede de casa, e o Proxmox muda de chave ao reinstalar.
 */
export function sshExec(
  target: SshTarget,
  command: string,
  options: SshExecOptions = {},
): Promise<SshResult> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const trim = (text: string) =>
    trimOutput(text, options.maxOutput ?? MAX_OUTPUT);

  return new Promise((resolve, reject) => {
    const client = new Client();
    let output = '';
    let settled = false;

    const finish = (error: Error | null, result?: SshResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.end();
      if (error) reject(error);
      else resolve(result!);
    };

    const timer = setTimeout(
      () =>
        finish(null, {
          exitCode: null,
          output: trim(
            `${output}\n(O comando passou de ${Math.round(timeoutMs / 1000)} s e a ligação foi fechada.)`,
          ),
        }),
      timeoutMs,
    );

    client
      .on('ready', () => {
        client.exec(command, (error, stream) => {
          if (error) return finish(error);
          stream
            .on('close', (code: number | null) =>
              finish(null, { exitCode: code ?? null, output: trim(output) }),
            )
            .on('data', (chunk: Buffer) => {
              output += chunk.toString('utf8');
            });
          stream.stderr.on('data', (chunk: Buffer) => {
            output += chunk.toString('utf8');
          });
          if (options.input !== undefined) stream.end(options.input);
        });
      })
      .on('error', (error) =>
        finish(
          new Error(
            `Não foi possível entrar por SSH em ${target.username}@${target.host}:${target.port}: ${error.message}`,
          ),
        ),
      )
      .connect({
        host: target.host,
        port: target.port,
        username: target.username,
        privateKey: target.privateKey,
        readyTimeout: 15_000,
      });
  });
}
