import { AgentTool } from '../claude-agent.client';
import { AgentContext } from '../agents/agent-context';
import {
  AdguardTarget,
  adguardTarget,
  checkDomain,
  getSettings,
  listFilters,
  manageFilter,
  manageRewrite,
  overview,
  queryLog,
  refreshFilters,
  setBlockedServices,
  setDomainRule,
  setFilterInterval,
  setProtection,
  setUserRules,
} from '../tools/adguardTools';

const ACCOUNT = {
  type: 'string' as const,
  description: 'O AdGuard (nome ou endereço). Omite quando só há um.',
};

const DOMAIN = {
  type: 'string' as const,
  description: 'O domínio, ex.: ads.exemplo.com.',
};

// As definições são fixas (a cache vive do prefixo igual); a conta e a password
// só entram nos handlers, que leem apenas as contas deste utilizador.
export function buildAdguardTools(context: AgentContext): AgentTool[] {
  const run =
    <T>(work: (target: AdguardTarget, input: T) => Promise<string>) =>
    async (input: T & { account?: string }) => {
      const target = await adguardTarget(
        context.connectedAccountRepository,
        context.userId,
        input.account,
      );
      return typeof target === 'string' ? target : work(target, input);
    };

  return [
    {
      name: 'adguard_overview',
      description:
        'Resumo do AdGuard Home: versão, se a proteção está ligada, pedidos e bloqueados das últimas 24 h, os domínios e clientes com mais pedidos e as listas. Bom ponto de partida.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((target) => overview(target)),
    },
    {
      name: 'adguard_query_log',
      description:
        'O registo de pedidos de DNS, os mais recentes primeiro: quem pediu, o domínio, se foi bloqueado e por que regra. Filtra por texto (domínio ou IP do cliente) e por bloqueados. Serve para perceber porque um site não abre.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          search: {
            type: 'string',
            description: 'Texto no domínio ou no cliente.',
          },
          status: {
            type: 'string',
            enum: ['all', 'blocked', 'processed'],
            description:
              'all (todos), blocked (só bloqueados) ou processed (só os que passaram).',
          },
          limit: {
            type: 'integer',
            description: 'Quantos (1 a 200, 50 por omissão).',
          },
        },
      },
      handler: run(queryLog),
    },
    {
      name: 'adguard_check_domain',
      description:
        'Diz se um domínio está bloqueado, permitido ou reescrito, e por que regra ou lista.',
      inputSchema: {
        type: 'object',
        properties: { account: ACCOUNT, domain: DOMAIN },
        required: ['domain'],
      },
      handler: run(checkDomain),
    },
    {
      name: 'adguard_list_filters',
      description:
        'As listas de bloqueio e de permissão (nome, URL, ligada, regras, última atualização) e as regras próprias.',
      inputSchema: { type: 'object', properties: { account: ACCOUNT } },
      handler: run((target) => listFilters(target)),
    },
    {
      name: 'adguard_get_settings',
      description:
        'Lê uma parte das definições: rewrites (reescritas de DNS, ex.: nas.casa → 192.168.1.10), clients (os dispositivos e as definições de cada um) ou blocked_services (serviços bloqueados para toda a rede e os ids que existem).',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          section: {
            type: 'string',
            enum: ['rewrites', 'clients', 'blocked_services'],
          },
        },
        required: ['section'],
      },
      handler: run(getSettings),
    },
    {
      name: 'adguard_set_protection',
      description:
        'Liga, desliga ou pausa a proteção do AdGuard para toda a rede. Para pausar, enabled=false com minutes (volta sozinha); sem minutes fica desligada até alguém a ligar.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          enabled: { type: 'boolean' },
          minutes: {
            type: 'integer',
            description: 'Só ao desligar: durante quantos minutos.',
          },
        },
        required: ['enabled'],
      },
      handler: run(setProtection),
    },
    {
      name: 'adguard_set_domain_rule',
      description:
        'Bloqueia (block), permite sempre (allow) ou tira as regras próprias (remove) de um domínio e dos subdomínios. Devolve as regras de antes, para se desfazer.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          domain: DOMAIN,
          action: { type: 'string', enum: ['block', 'allow', 'remove'] },
        },
        required: ['domain', 'action'],
      },
      handler: run(setDomainRule),
    },
    {
      name: 'adguard_set_user_rules',
      description:
        'Substitui TODAS as regras próprias (sintaxe do AdGuard: ||dominio^, @@||dominio^, /regex/, ! comentário). Lê-as primeiro com adguard_list_filters e manda a lista completa. Devolve as de antes.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          rules: {
            type: 'array',
            items: { type: 'string' },
            description: 'Uma regra por linha.',
          },
        },
        required: ['rules'],
      },
      handler: run(setUserRules),
    },
    {
      name: 'adguard_manage_filter',
      description:
        'Adiciona, remove, liga ou desliga uma lista de bloqueio (ou de permissão, com allowlist=true), pelo URL.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          action: {
            type: 'string',
            enum: ['add', 'remove', 'enable', 'disable'],
          },
          url: { type: 'string', description: 'O URL da lista.' },
          name: { type: 'string', description: 'O nome, ao adicionar.' },
          allowlist: {
            type: 'boolean',
            description: 'true para listas de permissão.',
          },
        },
        required: ['action', 'url'],
      },
      handler: run(manageFilter),
    },
    {
      name: 'adguard_refresh_filters',
      description:
        'Descarrega já as listas de bloqueio (ou as de permissão, com allowlist=true) e diz quantas mudaram.',
      inputSchema: {
        type: 'object',
        properties: { account: ACCOUNT, allowlist: { type: 'boolean' } },
      },
      handler: run(refreshFilters),
    },
    {
      name: 'adguard_set_filter_interval',
      description:
        'Muda de quantas em quantas horas o AdGuard descarrega as listas de bloqueio sozinho: 0 (nunca), 1, 12, 24, 72 ou 168. É uma definição do utilizador (página do AdGuard → Definições manuais): só a mudas quando ele pedir.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          hours: { type: 'number', enum: [0, 1, 12, 24, 72, 168] },
        },
        required: ['hours'],
      },
      handler: run(setFilterInterval),
    },
    {
      name: 'adguard_manage_rewrite',
      description:
        'Cria ou apaga uma reescrita de DNS: o domínio (pode ser *.casa) passa a responder com o IP ou o domínio indicado.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          action: { type: 'string', enum: ['add', 'delete'] },
          domain: DOMAIN,
          answer: {
            type: 'string',
            description: 'O IP ou o domínio da resposta, ex.: 192.168.1.10.',
          },
        },
        required: ['action', 'domain', 'answer'],
      },
      handler: run(manageRewrite),
    },
    {
      name: 'adguard_set_blocked_services',
      description:
        'Bloqueia ou desbloqueia serviços inteiros para toda a rede (ex.: tiktok, youtube), pelos ids de adguard_get_settings blocked_services. Devolve os de antes.',
      inputSchema: {
        type: 'object',
        properties: {
          account: ACCOUNT,
          block: { type: 'array', items: { type: 'string' } },
          unblock: { type: 'array', items: { type: 'string' } },
        },
      },
      handler: run(setBlockedServices),
    },
  ];
}
