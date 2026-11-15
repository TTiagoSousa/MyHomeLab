import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import {
  TrekMcpTool,
  isReadOnlyTool,
  trekMcpCall,
  trekMcpOf,
  trekMcpTools,
} from 'src/trek/trekMcp.client';

const RESULT_MAX = 30_000;

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
  `${account.displayName ?? 'TREK'} (${hostOf(account.baseUrl)})`;

const describeError = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/** O TREK a usar: o único, ou o que bate com o nome ou o endereço pedido. */
export async function trekTarget(
  repository: PrismaConnectedAccountRepository,
  userId: string,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await repository.findAllByUser(userId, ConnectionProvider.TREK)
  ).filter((account) => account.isActive && account.baseUrl);
  if (!accounts.length) {
    return 'Não há nenhum TREK ligado. Liga-o em Apps ligadas → TREK.';
  }
  const matches = wanted?.trim()
    ? accounts.filter((account) =>
        normalize(accountLabel(account)).includes(normalize(wanted)),
      )
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o TREK: ${accounts.map(accountLabel).join(', ')}.`;
  }
  return matches[0];
}

const NO_MCP =
  'Este TREK não tem o cliente MCP ligado: no TREK, Definições → Integrações → MCP → OAuth 2.1 Clients → New Client → "Machine client", com as permissões que quiseres; depois, no MyHomeLab, Apps ligadas → TREK → Conta → Cliente MCP. Sem ele só há a versão e os backups.';

const kindOf = (tool: TrekMcpTool) =>
  tool.annotations?.destructiveHint
    ? 'apaga'
    : isReadOnlyTool(tool)
      ? 'lê'
      : 'escreve';

const toolLine = (tool: TrekMcpTool) =>
  `- ${tool.name} [${kindOf(tool)}]${tool.title || tool.annotations?.title ? ` ${tool.title ?? tool.annotations?.title}` : ''} — ${(tool.description ?? '').split('\n')[0].slice(0, 160)}`;

async function toolsOf(account: ConnectedAccount) {
  const credentials = trekMcpOf(account);
  if (!credentials) return null;
  return { credentials, tools: await trekMcpTools(credentials) };
}

/** A versão, o MCP (quantas ferramentas) e as viagens (o list_trips do TREK). */
export async function overview(account: ConnectedAccount): Promise<string> {
  const head = `TREK ${accountLabel(account)} — versão ${account.appVersion ?? '?'}${account.appLatestVersion && account.appLatestVersion !== account.appVersion ? ` (há a ${account.appLatestVersion})` : ''}.`;
  try {
    const loaded = await toolsOf(account);
    if (!loaded) return `${head}\n${NO_MCP}`;
    const trips = loaded.tools.some((tool) => tool.name === 'list_trips')
      ? await trekMcpCall(loaded.credentials, 'list_trips', {})
      : null;
    return [
      head,
      `MCP ligado: ${loaded.tools.length} ferramentas (vê-as com trek_tools).`,
      trips ? `As viagens (list_trips):\n${trips.text.slice(0, 8000)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  } catch (error) {
    return `${head}\nO MCP do TREK falhou: ${describeError(error)}`;
  }
}

/** As ferramentas do TREK (filtradas por palavras ou pelo tipo). */
export async function listTools(
  account: ConnectedAccount,
  input: { query?: string; kind?: 'read' | 'write' },
): Promise<string> {
  try {
    const loaded = await toolsOf(account);
    if (!loaded) return NO_MCP;
    const words = normalize(input.query ?? '')
      .split(/\s+/)
      .filter(Boolean);
    const found = loaded.tools.filter((tool) => {
      if (input.kind === 'read' && !isReadOnlyTool(tool)) return false;
      if (input.kind === 'write' && isReadOnlyTool(tool)) return false;
      const haystack = normalize(
        `${tool.name} ${tool.title ?? ''} ${tool.description ?? ''}`,
      );
      return words.every((word) => haystack.includes(word));
    });
    if (!found.length) return 'Nenhuma ferramenta do TREK bate com isso.';
    return [
      `${found.length} de ${loaded.tools.length} ferramentas do TREK ([lê] usa-se com trek_read; [escreve] e [apaga] com trek_write). Os argumentos de cada uma vêem-se com trek_tool_help.`,
      ...found.map(toolLine),
    ].join('\n');
  } catch (error) {
    return `O MCP do TREK falhou: ${describeError(error)}`;
  }
}

/** A descrição inteira e os argumentos (o JSON Schema) de uma ferramenta. */
export async function toolHelp(
  account: ConnectedAccount,
  input: { name: string },
): Promise<string> {
  try {
    const loaded = await toolsOf(account);
    if (!loaded) return NO_MCP;
    const tool = loaded.tools.find((item) => item.name === input.name?.trim());
    if (!tool) {
      return `O TREK não tem a ferramenta "${input.name}". Procura-a com trek_tools.`;
    }
    return [
      `${tool.name} [${kindOf(tool)}]`,
      tool.description ?? '',
      `Argumentos (JSON Schema):\n${JSON.stringify(tool.inputSchema ?? {}, null, 1).slice(0, 12_000)}`,
    ].join('\n\n');
  } catch (error) {
    return `O MCP do TREK falhou: ${describeError(error)}`;
  }
}

/**
 * Chama uma ferramenta do TREK. `write` falso só deixa as que leem; as que apagam
 * pedem `confirm: true`, que só se dá quando ele pediu para apagar aquilo.
 */
export async function callTool(
  account: ConnectedAccount,
  input: {
    tool: string;
    arguments?: Record<string, unknown>;
    confirm?: boolean;
  },
  write: boolean,
): Promise<string> {
  try {
    const loaded = await toolsOf(account);
    if (!loaded) return NO_MCP;
    const tool = loaded.tools.find((item) => item.name === input.tool?.trim());
    if (!tool) {
      return `O TREK não tem a ferramenta "${input.tool}". Procura-a com trek_tools.`;
    }
    if (!write && !isReadOnlyTool(tool)) {
      return `${tool.name} mexe no TREK: usa trek_write (precisa de poder alterar o TREK).`;
    }
    if (tool.annotations?.destructiveHint && !input.confirm) {
      return `${tool.name} apaga dados no TREK. Só com confirm: true, e só se ele pediu para apagar isto.`;
    }
    const result = await trekMcpCall(
      loaded.credentials,
      tool.name,
      input.arguments ?? {},
    );
    const text =
      result.text.length > RESULT_MAX
        ? `${result.text.slice(0, RESULT_MAX)}\n… (cortado em ${RESULT_MAX} caracteres)`
        : result.text;
    return result.isError
      ? `O TREK recusou ${tool.name}: ${text}`
      : text || `${tool.name}: feito (sem texto de resposta).`;
  } catch (error) {
    return `O MCP do TREK falhou: ${describeError(error)}`;
  }
}
