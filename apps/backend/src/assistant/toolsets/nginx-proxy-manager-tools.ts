import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import {
  createNginxProxyManagerClient,
  NginxAccessList,
  NginxCertificate,
  NginxDeadHost,
  NginxHostKind,
  NginxProxyHost,
  NginxProxyHostInput,
  NginxProxyManagerClient,
  NginxRedirectionHost,
  NginxStream,
  NginxTimeoutError,
  nginxProxyManagerHealth,
} from 'src/nginx-proxy-manager/nginx-proxy-manager.client';
import { lisbonStamp } from 'src/utils/lisbonTime';

const fold = (text: string) => text.trim().toLowerCase();

const ACCOUNT = {
  type: 'string' as const,
  description:
    'O Nginx Proxy Manager (nome ou endereço). Omite quando só há um.',
};

const HOST = {
  type: 'string' as const,
  description: 'O id ou um dos domínios do proxy host.',
};

const KIND_NAME: Record<NginxHostKind, string> = {
  'proxy-hosts': 'proxy host',
  'redirection-hosts': 'redirecionamento',
  'dead-hosts': 'host 404',
  streams: 'stream',
};

const DAY = 24 * 60 * 60 * 1000;

const day = (iso?: string | null) => (iso ? iso.slice(0, 10) : '—');

const isOn = (enabled: boolean | number) => Boolean(enabled);

/** O Nginx Proxy Manager a usar: o único, ou o que bate com o nome ou o endereço. */
export async function nginxProxyManagerTarget(
  context: AgentContext,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await context.connectedAccountRepository.findAllByUser(
      context.userId,
      ConnectionProvider.NGINX_PROXY_MANAGER,
    )
  ).filter(
    (account) =>
      account.isActive &&
      account.baseUrl &&
      account.username &&
      account.appPassword,
  );
  if (!accounts.length) {
    return 'Não há nenhum Nginx Proxy Manager ligado. Liga-o em Apps ligadas → Nginx Proxy Manager.';
  }
  const label = (account: ConnectedAccount) =>
    `${account.displayName ?? 'Nginx Proxy Manager'} (${account.baseUrl})`;
  const matches = wanted?.trim()
    ? accounts.filter((account) => fold(label(account)).includes(fold(wanted)))
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o Nginx Proxy Manager: ${accounts.map(label).join(', ')}.`;
  }
  return matches[0];
}

/** Um proxy host pelo id ou por um dos domínios (exato, ou parte sem ambiguidade). */
export function pickProxyHost(
  all: NginxProxyHost[],
  wanted: string | number,
): NginxProxyHost {
  const text = fold(String(wanted));
  const byId = /^\d+$/.test(text)
    ? all.find((item) => item.id === Number(text))
    : undefined;
  if (byId) return byId;
  const exact = all.find((item) =>
    item.domain_names.some((domain) => fold(domain) === text),
  );
  if (exact) return exact;
  const partial = all.filter((item) =>
    item.domain_names.some((domain) => fold(domain).includes(text)),
  );
  if (partial.length === 1) return partial[0];
  throw new Error(
    partial.length
      ? `há vários «${wanted}»: ${partial.map((item) => `${item.id} ${item.domain_names.join(', ')}`).join('; ')}`
      : `o Nginx Proxy Manager não tem um proxy host «${wanted}»`,
  );
}

/** Dias até o certificado expirar (negativo = já expirou; null = sem data). */
export function daysLeft(certificate: NginxCertificate, now = Date.now()) {
  if (!certificate.expires_on) return null;
  const time = Date.parse(certificate.expires_on.replace(' ', 'T'));
  return Number.isNaN(time) ? null : Math.floor((time - now) / DAY);
}

const certificateName = (certificate: NginxCertificate) =>
  certificate.nice_name || certificate.domain_names.join(', ');

const proxyLine = (item: NginxProxyHost) =>
  `- ${item.id} ${item.domain_names.join(', ')} → ${item.forward_scheme}://${item.forward_host}:${item.forward_port}${isOn(item.enabled) ? '' : ' (DESLIGADO)'}${item.meta?.nginx_online === false ? ' (nginx com erro)' : ''}${item.certificate_id ? ` — SSL${item.certificate ? ` ${certificateName(item.certificate)}` : ` #${item.certificate_id}`}${item.ssl_forced ? ', forçado' : ''}` : ' — sem SSL'}${item.access_list ? ` — acesso: ${item.access_list.name}` : ''}`;

/** O que se pode mandar ao criar ou mudar: só os campos que a API aceita. */
const HOST_FIELDS = {
  domains: {
    type: 'array',
    items: { type: 'string' },
    description: 'Os domínios (ex.: ["app.exemplo.com"]).',
  },
  forward_scheme: { type: 'string', enum: ['http', 'https'] },
  forward_host: {
    type: 'string',
    description: 'O IP ou nome para onde encaminha.',
  },
  forward_port: { type: 'integer' },
  certificate: {
    type: 'string',
    description:
      'O certificado: o id, um domínio dele, ou "none" para tirar. Tem de já existir (vê nginx_proxy_manager_certificates).',
  },
  access_list: {
    type: 'string',
    description: 'A lista de acesso (id ou nome), ou "none" para pública.',
  },
  ssl_forced: { type: 'boolean' },
  http2_support: { type: 'boolean' },
  hsts_enabled: { type: 'boolean' },
  hsts_subdomains: { type: 'boolean' },
  block_exploits: { type: 'boolean' },
  caching_enabled: { type: 'boolean' },
  allow_websocket_upgrade: { type: 'boolean' },
  advanced_config: {
    type: 'string',
    description: 'Configuração nginx extra (o separador Advanced).',
  },
};

interface HostFieldsInput {
  domains?: string[];
  forward_scheme?: 'http' | 'https';
  forward_host?: string;
  forward_port?: number;
  certificate?: string;
  access_list?: string;
  ssl_forced?: boolean;
  http2_support?: boolean;
  hsts_enabled?: boolean;
  hsts_subdomains?: boolean;
  block_exploits?: boolean;
  caching_enabled?: boolean;
  allow_websocket_upgrade?: boolean;
  advanced_config?: string;
}

const FLAGS = [
  'ssl_forced',
  'http2_support',
  'hsts_enabled',
  'hsts_subdomains',
  'block_exploits',
  'caching_enabled',
  'allow_websocket_upgrade',
] as const;

/** Passa os campos da ferramenta para o corpo da API, resolvendo o certificado e a lista de acesso. */
async function hostPayload(
  npm: NginxProxyManagerClient,
  input: HostFieldsInput,
): Promise<NginxProxyHostInput> {
  const payload: NginxProxyHostInput = {};
  if (input.domains?.length)
    payload.domain_names = input.domains.map((domain) => fold(domain));
  if (input.forward_scheme) payload.forward_scheme = input.forward_scheme;
  if (input.forward_host?.trim())
    payload.forward_host = input.forward_host.trim();
  if (input.forward_port) payload.forward_port = input.forward_port;
  for (const flag of FLAGS) {
    if (typeof input[flag] === 'boolean') payload[flag] = input[flag];
  }
  if (typeof input.advanced_config === 'string')
    payload.advanced_config = input.advanced_config;
  if (input.certificate?.trim()) {
    const wanted = fold(input.certificate);
    if (wanted === 'none' || wanted === '0') payload.certificate_id = 0;
    else {
      const all = await npm.certificates();
      const found =
        all.find((item) => String(item.id) === wanted) ??
        all.find((item) =>
          item.domain_names.some((domain) => fold(domain) === wanted),
        ) ??
        all.find((item) => fold(item.nice_name ?? '') === wanted);
      if (!found)
        throw new Error(
          `não há o certificado «${input.certificate}» (cria-o primeiro no Nginx Proxy Manager)`,
        );
      payload.certificate_id = found.id;
    }
  }
  if (input.access_list?.trim()) {
    const wanted = fold(input.access_list);
    if (wanted === 'none' || wanted === '0') payload.access_list_id = 0;
    else {
      const all = await npm.accessLists();
      const found =
        all.find((item) => String(item.id) === wanted) ??
        all.find((item) => fold(item.name) === wanted);
      if (!found)
        throw new Error(`não há a lista de acesso «${input.access_list}»`);
      payload.access_list_id = found.id;
    }
  }
  return payload;
}

export function buildNginxProxyManagerTools(
  context: AgentContext,
): AgentTool[] {
  const run =
    <T>(
      work: (
        npm: NginxProxyManagerClient,
        input: T,
        account: ConnectedAccount,
      ) => Promise<string>,
    ) =>
    async (input: T & { account?: string }) => {
      const account = await nginxProxyManagerTarget(context, input.account);
      if (typeof account === 'string') return account;
      try {
        return await work(
          createNginxProxyManagerClient(
            account.baseUrl ?? '',
            account.username ?? '',
            account.appPassword ?? '',
          ),
          input,
          account,
        );
      } catch (error) {
        return `Falhou: ${error instanceof Error ? error.message : String(error)}`;
      }
    };

  return [
    {
      name: 'nginx_proxy_manager_overview',
      description:
        'O Nginx Proxy Manager (o proxy inverso que põe as apps nos domínios, com SSL): a versão, quantos proxy hosts, redirecionamentos, hosts 404 e streams (e quantos desligados ou com erro no nginx), as listas de acesso e os certificados que expiram nos próximos 30 dias.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (npm, _input, account) => {
        const [
          health,
          proxies,
          redirections,
          dead,
          streams,
          lists,
          certificates,
        ] = await Promise.all([
          nginxProxyManagerHealth(account.baseUrl ?? ''),
          npm.proxyHosts(),
          npm.redirectionHosts().catch((): NginxRedirectionHost[] => []),
          npm.deadHosts().catch((): NginxDeadHost[] => []),
          npm.streams().catch((): NginxStream[] => []),
          npm.accessLists().catch((): NginxAccessList[] => []),
          npm.certificates().catch((): NginxCertificate[] => []),
        ]);
        const off = (items: { enabled: boolean | number }[]) =>
          items.filter((item) => !isOn(item.enabled)).length;
        const broken = [
          ...proxies,
          ...redirections,
          ...dead,
          ...streams,
        ].filter((item) => item.meta?.nginx_online === false).length;
        const soon = certificates
          .map((item) => ({ item, days: daysLeft(item) }))
          .filter((entry) => entry.days !== null && entry.days <= 30)
          .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
        const version = health.version
          ? `v${health.version.major}.${health.version.minor}.${health.version.revision}`
          : '?';
        return [
          `Nginx Proxy Manager ${version} — ${health.status ?? '?'}.`,
          `Proxy hosts: ${proxies.length} (${off(proxies)} desligados). Redirecionamentos: ${redirections.length}. Hosts 404: ${dead.length}. Streams: ${streams.length}.`,
          broken
            ? `${broken} com erro no nginx (vê nginx_proxy_manager_hosts).`
            : '',
          `Listas de acesso: ${lists.length ? lists.map((list) => list.name).join(', ') : 'nenhuma'}.`,
          `Certificados: ${certificates.length}.`,
          soon.length
            ? `Expiram em 30 dias ou já expiraram:\n${soon
                .map(
                  ({ item, days }) =>
                    `- ${item.id} ${certificateName(item)} (${item.provider}) — ${(days ?? 0) < 0 ? 'EXPIROU' : `faltam ${days} dias`} (${day(item.expires_on)})`,
                )
                .join('\n')}`
            : 'Nenhum certificado expira nos próximos 30 dias.',
        ]
          .filter(Boolean)
          .join('\n');
      }),
    },
    {
      name: 'nginx_proxy_manager_hosts',
      description:
        'Os hosts do Nginx Proxy Manager: proxy hosts (domínio → destino, SSL, lista de acesso), redirecionamentos, hosts 404 ou streams (portas TCP/UDP). Filtra por texto no domínio ou no destino.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['proxy-hosts', 'redirection-hosts', 'dead-hosts', 'streams'],
            description: 'Omissão: proxy-hosts.',
          },
          search: { type: 'string' },
          account: ACCOUNT,
        },
      },
      handler: run(
        async (npm, input: { kind?: NginxHostKind; search?: string }) => {
          const kind = input.kind ?? 'proxy-hosts';
          const matches = (text: string) =>
            !input.search || fold(text).includes(fold(input.search));
          let lines: string[] = [];
          if (kind === 'proxy-hosts') {
            lines = (await npm.proxyHosts())
              .filter((item) =>
                matches(`${item.domain_names.join(' ')} ${item.forward_host}`),
              )
              .map(proxyLine);
          } else if (kind === 'redirection-hosts') {
            lines = (await npm.redirectionHosts())
              .filter((item) =>
                matches(
                  `${item.domain_names.join(' ')} ${item.forward_domain_name}`,
                ),
              )
              .map(
                (item) =>
                  `- ${item.id} ${item.domain_names.join(', ')} → ${item.forward_http_code} ${item.forward_scheme === 'auto' ? '' : `${item.forward_scheme}://`}${item.forward_domain_name}${item.preserve_path ? ' (mantém o caminho)' : ''}${isOn(item.enabled) ? '' : ' (DESLIGADO)'}`,
              );
          } else if (kind === 'dead-hosts') {
            lines = (await npm.deadHosts())
              .filter((item) => matches(item.domain_names.join(' ')))
              .map(
                (item) =>
                  `- ${item.id} ${item.domain_names.join(', ')}${isOn(item.enabled) ? '' : ' (DESLIGADO)'}`,
              );
          } else {
            lines = (await npm.streams())
              .filter((item) =>
                matches(`${item.incoming_port} ${item.forwarding_host}`),
              )
              .map(
                (item) =>
                  `- ${item.id} :${item.incoming_port} → ${item.forwarding_host}:${item.forwarding_port} (${[item.tcp_forwarding ? 'TCP' : '', item.udp_forwarding ? 'UDP' : ''].filter(Boolean).join('+')})${isOn(item.enabled) ? '' : ' (DESLIGADO)'}`,
              );
          }
          return lines.length
            ? `${lines.length} ${KIND_NAME[kind]}s:\n${lines.slice(0, 300).join('\n')}`
            : `Nenhum ${KIND_NAME[kind]}.`;
        },
      ),
    },
    {
      name: 'nginx_proxy_manager_host',
      description:
        'Um proxy host do Nginx Proxy Manager em detalhe (pelo id ou por um domínio): o destino, o certificado e quando expira, a lista de acesso, as opções (SSL forçado, HTTP/2, HSTS, websockets, cache, bloquear exploits), a configuração extra e o erro do nginx, se houver.',
      inputSchema: {
        type: 'object',
        properties: { host: HOST, account: ACCOUNT },
        required: ['host'],
      },
      handler: run(async (npm, input: { host: string }) => {
        const found = pickProxyHost(await npm.proxyHosts(), input.host);
        const item = await npm.proxyHost(found.id);
        const certificate = item.certificate ?? null;
        const days = certificate ? daysLeft(certificate) : null;
        return [
          proxyLine(item),
          certificate
            ? `Certificado: ${certificate.id} ${certificateName(certificate)} (${certificate.provider}) — expira ${day(certificate.expires_on)}${days !== null ? ` (${days} dias)` : ''}`
            : 'Sem certificado.',
          `Opções: ${FLAGS.map((flag) => `${flag}=${item[flag] ? 'sim' : 'não'}`).join(', ')}.`,
          item.locations?.length
            ? `Locations: ${JSON.stringify(item.locations).slice(0, 800)}`
            : '',
          item.advanced_config?.trim()
            ? `Configuração extra:\n${item.advanced_config.slice(0, 2000)}`
            : '',
          item.meta?.nginx_err ? `Erro do nginx: ${item.meta.nginx_err}` : '',
          `Criado ${day(item.created_on)}, mudado ${day(item.modified_on)}.`,
        ]
          .filter(Boolean)
          .join('\n');
      }),
    },
    {
      name: 'nginx_proxy_manager_create_host',
      description:
        'Cria um proxy host no Nginx Proxy Manager: os domínios, o destino (esquema, host, porta) e, se ele quiser, um certificado que já exista, a lista de acesso e as opções. Por omissão bloqueia exploits e deixa websockets. Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: { ...HOST_FIELDS, account: ACCOUNT },
        required: ['domains', 'forward_host', 'forward_port'],
      },
      handler: run(async (npm, input: HostFieldsInput) => {
        if (!input.domains?.length) return 'Diz os domínios.';
        const payload = await hostPayload(npm, {
          forward_scheme: 'http',
          block_exploits: true,
          allow_websocket_upgrade: true,
          ...input,
        });
        if (payload.certificate_id && input.ssl_forced === undefined)
          payload.ssl_forced = true;
        const created = await npm.createProxyHost(payload);
        return `Criei o proxy host ${created.id}: ${proxyLine(created).slice(2)}.`;
      }),
    },
    {
      name: 'nginx_proxy_manager_update_host',
      description:
        'Muda um proxy host do Nginx Proxy Manager (pelo id ou por um domínio): só os campos que mandares (domínios, destino, certificado, lista de acesso, opções, configuração extra). Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: { host: HOST, ...HOST_FIELDS, account: ACCOUNT },
        required: ['host'],
      },
      handler: run(async (npm, input: HostFieldsInput & { host: string }) => {
        const found = pickProxyHost(await npm.proxyHosts(), input.host);
        const payload = await hostPayload(npm, input);
        if (!Object.keys(payload).length) return 'Diz o que mudar.';
        const updated = await npm.updateProxyHost(found.id, payload);
        return `Mudei o proxy host ${found.id}: ${proxyLine(updated).slice(2)}.`;
      }),
    },
    {
      name: 'nginx_proxy_manager_toggle_host',
      description:
        'Liga ou desliga um host do Nginx Proxy Manager (proxy host, redirecionamento, host 404 ou stream) pelo id; num proxy host também serve um domínio. Desligado, o domínio deixa de responder. Faz só quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          host: HOST,
          kind: {
            type: 'string',
            enum: ['proxy-hosts', 'redirection-hosts', 'dead-hosts', 'streams'],
            description: 'Omissão: proxy-hosts.',
          },
          enabled: { type: 'boolean' },
          account: ACCOUNT,
        },
        required: ['host', 'enabled'],
      },
      handler: run(
        async (
          npm,
          input: { host: string; kind?: NginxHostKind; enabled: boolean },
        ) => {
          const kind = input.kind ?? 'proxy-hosts';
          let id = Number(input.host);
          if (kind === 'proxy-hosts')
            id = pickProxyHost(await npm.proxyHosts(), input.host).id;
          else if (!Number.isInteger(id) || id <= 0)
            return `Diz o id do ${KIND_NAME[kind]} (vê nginx_proxy_manager_hosts).`;
          await npm.setEnabled(kind, id, input.enabled);
          return `${input.enabled ? 'Liguei' : 'Desliguei'} o ${KIND_NAME[kind]} ${id}.`;
        },
      ),
    },
    {
      name: 'nginx_proxy_manager_delete_host',
      description:
        'Apaga um proxy host do Nginx Proxy Manager (pelo id ou por um domínio). Não se desfaz: o domínio deixa de responder e a configuração perde-se (desligar com nginx_proxy_manager_toggle_host é reversível). Confirma com ele antes, dizendo o domínio e o destino.',
      inputSchema: {
        type: 'object',
        properties: { host: HOST, account: ACCOUNT },
        required: ['host'],
      },
      handler: run(async (npm, input: { host: string }) => {
        const found = pickProxyHost(await npm.proxyHosts(), input.host);
        await npm.deleteProxyHost(found.id);
        return `Apaguei o proxy host ${found.id} (${found.domain_names.join(', ')} → ${found.forward_host}:${found.forward_port}).`;
      }),
    },
    {
      name: 'nginx_proxy_manager_certificates',
      description:
        'Os certificados SSL do Nginx Proxy Manager: o id, os domínios, quem os emitiu (letsencrypt ou carregado), quando expiram e quantos dias faltam, os que expiram primeiro no topo. Sem chaves privadas.',
      inputSchema: {
        type: 'object',
        properties: {
          expiring_days: {
            type: 'integer',
            description: 'Só os que expiram nestes dias (ex.: 30).',
          },
          account: ACCOUNT,
        },
      },
      handler: run(async (npm, input: { expiring_days?: number }) => {
        const found = (await npm.certificates())
          .map((item) => ({ item, days: daysLeft(item) }))
          .filter(
            (entry) =>
              input.expiring_days === undefined ||
              (entry.days !== null && entry.days <= input.expiring_days),
          )
          .sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999));
        if (!found.length) return 'Nenhum certificado.';
        return found
          .map(
            ({ item, days }) =>
              `- ${item.id} ${certificateName(item)} [${item.domain_names.join(', ')}] (${item.provider}) — expira ${day(item.expires_on)}${days !== null ? (days < 0 ? ' — EXPIROU' : ` — faltam ${days} dias`) : ''}`,
          )
          .join('\n');
      }),
    },
    {
      name: 'nginx_proxy_manager_renew_certificate',
      description:
        "Renova agora um certificado Let's Encrypt do Nginx Proxy Manager (pelo id ou por um domínio). Os carregados à mão não se renovam assim. Pode demorar uns minutos (espero até 5); se disser que ainda pode estar a correr, não repitas: vê a validade mais tarde. Faz só quando ele pedir.",
      inputSchema: {
        type: 'object',
        properties: {
          certificate: { type: 'string', description: 'O id ou um domínio.' },
          account: ACCOUNT,
        },
        required: ['certificate'],
      },
      handler: run(async (npm, input: { certificate: string }) => {
        const wanted = fold(input.certificate);
        const all = await npm.certificates();
        const found =
          all.find((item) => String(item.id) === wanted) ??
          all.find((item) =>
            item.domain_names.some((domain) => fold(domain) === wanted),
          );
        if (!found) return `Não há o certificado «${input.certificate}».`;
        if (found.provider !== 'letsencrypt')
          return `O certificado ${found.id} (${certificateName(found)}) foi carregado à mão: renova-o carregando um novo.`;
        let renewed: NginxCertificate;
        try {
          renewed = await npm.renewCertificate(found.id);
        } catch (error) {
          // A renovação pode continuar no NPM: repetir já pode bater no limite do Let's Encrypt.
          if (error instanceof NginxTimeoutError) {
            return `O Nginx Proxy Manager ainda não respondeu à renovação de ${certificateName(found)}: pode ainda estar a correr. Não tentes outra vez já (o Let's Encrypt tem limite de tentativas); vê a validade com nginx_proxy_manager_certificates daqui a uns minutos.`;
          }
          throw error;
        }
        return `Renovei ${certificateName(found)}: expira agora ${day(renewed.expires_on ?? found.expires_on)}.`;
      }),
    },
    {
      name: 'nginx_proxy_manager_access_lists',
      description:
        'As listas de acesso do Nginx Proxy Manager: o nome, os utilizadores (sem passwords), os IPs permitidos ou negados, se basta um dos dois e quantos proxy hosts as usam.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run(async (npm) => {
        const lists = await npm.accessLists();
        if (!lists.length) return 'Nenhuma lista de acesso.';
        return lists
          .map(
            (list) =>
              `- ${list.id} ${list.name}${list.satisfy_any ? ' (basta um)' : ' (todos)'} — ${list.proxy_host_count ?? '?'} hosts — utilizadores: ${
                (list.items ?? [])
                  .map((item) => item.username)
                  .filter(Boolean)
                  .join(', ') || 'nenhum'
              } — IPs: ${(list.clients ?? []).map((client) => `${client.directive} ${client.address}`).join(', ') || 'nenhum'}`,
          )
          .join('\n');
      }),
    },
    {
      name: 'nginx_proxy_manager_audit',
      description:
        'O registo de alterações do Nginx Proxy Manager (quem criou, mudou, ligou, desligou ou apagou o quê e quando), o mais recente primeiro.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Até 100 (omissão 25).' },
          account: ACCOUNT,
        },
      },
      handler: run(async (npm, input: { limit?: number }) => {
        const entries = await npm.auditLog();
        if (!entries.length) return 'Sem alterações registadas.';
        return entries
          .slice(0, Math.min(input.limit ?? 25, 100))
          .map((entry) => {
            const meta = entry.meta ?? {};
            const domains = Array.isArray(meta.domain_names)
              ? ` ${(meta.domain_names as string[]).join(', ')}`
              : typeof meta.name === 'string'
                ? ` ${meta.name}`
                : '';
            return `- ${lisbonStamp(entry.created_on)} ${entry.user?.name ?? '?'} ${entry.action} ${entry.object_type} ${entry.object_id}${domains}`;
          })
          .join('\n');
      }),
    },
  ];
}
