import {
  ConnectionProvider,
  DocKind,
  DocLinkType,
} from 'src/generated/prisma/client/client';
import { PROCESS_DOCS } from './processDocs';

export interface StarterDoc {
  title: string;
  kind: DocKind;
  tags: string[];
  summary: string;
  content: string;
  links: { type: DocLinkType; targetId: string; label: string }[];
}

/** A legenda dos pontos (igual em todos os documentos de regras de atualizações). */
export const CHECK_LEGEND =
  '🤖 o agente verifica · 👤 só tu confirmas · "prova:" é o que serve de prova · ⏭ saltada por pedido direto teu';

export const GENERAL_RULES: StarterDoc = {
  title: 'Regras gerais do servidor',
  kind: DocKind.RULES,
  tags: ['regras', 'servidor'],
  summary:
    'Como os agentes mexem nos servidores e nas apps que lá correm: antes, durante e depois, horários e o que nunca fazer.',
  links: [
    {
      type: DocLinkType.AGENT,
      targetId: 'infra',
      label: 'Engenheiro de Infraestrutura',
    },
    {
      type: DocLinkType.AGENT,
      targetId: 'proxmox',
      label: 'Operador Proxmox',
    },
  ],
  content: `# Regras gerais do servidor

Valem para tudo o que os agentes fazem nos servidores. As regras de cada app ganham a estas.

## Antes de mexer
- Ler os documentos do que se vai mexer (a app, a máquina, o servidor).
- Primeiro ler e medir; depois agir. Se o pedido não for claro, perguntar.

## Ao mexer
- Uma mudança de cada vez, e só depois de garantir o caminho de volta (snapshot, backup ou cópia do ficheiro).
- Se algo falhar: parar, voltar atrás e dizer-me o que aconteceu. Nada de tentar à sorte.

## Depois de mexer
- Confirmar que ficou a funcionar (responde, logs sem erros novos) e deixar registo.

## Horários
- Atualizações: a qualquer hora, logo que eu a ponho em Ready to update.
- Outras mudanças que podem deixar serviços em baixo: entre as 9h e as 22h, ou quando eu pedir.

## Aprovar
- **Atualizações:** o estudo acaba sempre em **Waiting for reply** com a recomendação (ou em Recheck later). Só eu a ponho em **Ready to update**, e isso é a aprovação: instala-se logo. Se um ponto falhar, fica em Waiting com a pergunta exata (chega-me às notificações).
- **Salto de versão major:** só com o meu sim para esse salto.
- **Sempre com snapshot.** Sem snapshot só se eu disser.
- **Outras mudanças com risco:** dizer-me o que muda, como se confirma e como se volta atrás, e esperar pelo meu sim.

## Nunca, sem me perguntar
- Apagar dados: volumes, discos, bases de dados, snapshots, backups ou repositórios.
- Comandos que destroem discos ou o sistema: \`rm -rf /\`, \`mkfs\`, \`wipefs\`, \`sgdisk --zap\`, \`dd\` para um disco, \`zpool destroy\`, \`zfs destroy -r\`, \`pveceph purge\`, \`pvecm delnode\`, \`chmod\`/\`chown -R\` na raiz.
- Reiniciar ou desligar o nó Proxmox, ou mexer na rede e nos discos dele.
- Mexer no CT/VM do próprio MyHomeLab.
- Abrir serviços para a internet, ou mudar certificados ou o DNS público.
- Escrever passwords, tokens ou chaves no chat, em documentos ou em tarefas.
`,
};

/** Os pontos que todas as apps do servidor têm antes de atualizar. */
const BEFORE = [
  '🤖 O backup do MyHomeLab desta app está atualizado: menos de 24 h e sem erro (Apps ligadas → a app → Backups). Se não estiver, corre-o (run_backup) e espera que acabe bem — prova: a hora do último backup bom',
  '🤖 O disco do CT/VM está abaixo de 90% e a memória abaixo de 100%. Se não estiver, aumentar esse recurso 10% (pve_set_resources, pelo Operador Proxmox), sem me perguntar, e voltar a medir — prova: a percentagem de cada um',
  '🤖 Li as notas de todas as versões pelo meio e não há passos à mão por fazer — prova: as versões lidas',
  '🤖 A versão saiu há pelo menos 3 dias e não há issues graves abertas — prova: a data e os links vistos',
  '👤 Se é um salto de versão major, eu disse que sim — prova: a minha resposta ou "não é major"',
  '🤖 A app responde na versão de partida e não há outra atualização a correr no servidor — prova: a versão e o que está a correr',
];

/** O backup do MyHomeLab do Nextcloud só leva os dados (calendários, contactos): para voltar atrás é preciso o da máquina no Proxmox. */
const NEXTCLOUD_BACKUP =
  '🤖 Há um backup da máquina do Nextcloud (CT ou VM) no Proxmox com menos de 24 h e sem erro. Se não houver, faz um (pve_backup_now, pelo Operador Proxmox) e espera que acabe bem — prova: a hora e o ficheiro do backup';

/** Os pontos que todas as apps do servidor têm depois de atualizar. */
const AFTER_START = [
  '🤖 A app responde na versão nova em menos de 5 minutos — prova: a versão e o tempo',
  '🤖 Os logs não têm erros novos — prova: as linhas vistas ou "nenhuma"',
];
const AFTER_END = [
  '🤖 Correu um backup novo pelo MyHomeLab — prova: a hora e o resultado',
];

interface AppRules {
  name: string;
  where?: string;
  /** Um ponto a juntar ao backup do MyHomeLab, para as apps em que ele não chega para voltar atrás (ex.: o Nextcloud). */
  backup?: string;
  before: string[];
  after: string[];
  never: string[];
}

/** O que cada app pede de especial. */
const APP_RULES: Partial<Record<ConnectionProvider, AppRules>> = {
  [ConnectionProvider.ADGUARD]: {
    name: 'AdGuard',
    before: [],
    after: [
      '🤖 Resolve google.com e um domínio da casa pelo AdGuard — prova: as respostas',
      '🤖 As reescritas DNS e as regras próprias continuam lá (comparar com o backup) — prova: as contagens',
      '🤖 As listas de bloqueio atualizam sem erro e o registo de consultas recebe pedidos — prova: o que se viu',
    ],
    never: [
      'Desligar a proteção ou uma lista inteira para desbloquear um site (desbloqueia-se o domínio).',
      'Mudar os upstreams, o DNS-over-HTTPS ou os certificados sem me perguntar.',
    ],
  },
  [ConnectionProvider.TREK]: {
    name: 'TREK',
    before: [
      '🤖 O zip do backup tem a chave de encriptação — prova: o ficheiro visto',
      '🤖 Nas versões major, há espaço para a cópia da base de dados que a migração faz — prova: o espaço livre',
    ],
    after: [
      '🤖 O login funciona e uma viagem abre com o mapa e as fotos — prova: o que se viu',
    ],
    never: [
      'Apagar os volumes do Docker.',
      'Mudar ou perder a chave de encriptação (sem ela os dados não se leem).',
    ],
  },
  [ConnectionProvider.OPENGYM]: {
    name: 'openGym',
    before: [
      '🤖 O backup do MyHomeLab do openGym (o estado de cada perfil, em JSON) correu há pouco — prova: a hora do último bom',
      '🤖 Ninguém está a meio de um treino (um treino a decorrer vive no telemóvel e só sobe no fim) — prova: o último treino visto',
    ],
    after: [
      '🤖 O /api/health responde ok e writable — prova: o JSON',
      '🤖 A página abre, as rotinas e os treinos estão lá (opengym_overview) — prova: os números',
    ],
    never: [
      'Apagar a pasta de dados do openGym (DATA_DIR) ou o db.json.',
      'Mudar o segredo das sessões (desliga todas as apps emparelhadas).',
    ],
  },
  [ConnectionProvider.GAMETRACKER]: {
    name: 'GamesTracker',
    before: [
      '🤖 O backup do MyHomeLab do GamesTracker (a base de dados, pg_dump) correu há pouco — prova: a hora do último bom',
    ],
    after: [
      '🤖 O /api/health responde ok com a versão nova — prova: o JSON',
      '🤖 A prateleira está lá, com os mesmos jogos (gametracker_overview) — prova: os números',
    ],
    never: [
      'Apagar a base de dados do GamesTracker ou os backups em /var/backups/gametracker.',
      'Mudar ou perder a TOKEN_ENCRYPTION_KEY (sem ela as chaves guardadas não se leem).',
    ],
  },
  [ConnectionProvider.IMMICH]: {
    name: 'Immich',
    before: [
      '🤖 O backup do MyHomeLab do Immich (a base de dados) correu há pouco — prova: a hora do último bom',
      '👤 As fotos (a pasta UPLOAD_LOCATION) têm cópia à parte — o backup do MyHomeLab só leva a base de dados',
      '🤖 As notas da versão nova não pedem passos à mão (mudanças no docker-compose ou no .env) — prova: o excerto das notas',
    ],
    after: [
      '🤖 O /api/server/version responde com a versão nova — prova: a versão',
      '🤖 As fotos e os álbuns estão lá, com os mesmos números (immich_overview) — prova: os números',
      '🤖 As filas não ficaram com falhas novas (immich_queues) — prova: as falhadas',
    ],
    never: [
      'Apagar fotos, álbuns, a pasta UPLOAD_LOCATION ou os backups em UPLOAD_LOCATION/backups.',
      'Correr uma fila com force (refaz tudo) sem o sim dele.',
    ],
  },
  [ConnectionProvider.PAPERLESS]: {
    name: 'Paperless',
    before: [
      '👤 Há um export recente dos documentos no servidor (document_exporter) — o backup do MyHomeLab só leva a arrumação e a configuração',
      '🤖 As notas da versão nova não pedem passos à mão (mudanças no docker-compose ou no ambiente) — prova: o excerto das notas',
    ],
    after: [
      '🤖 O Paperless responde com a versão nova (paperless_overview) — prova: a versão',
      '🤖 Os documentos estão lá, com o mesmo número, e a saúde está OK (paperless_overview) — prova: os números',
      '🤖 Não ficaram tarefas falhadas novas (paperless_tasks) — prova: a lista',
    ],
    never: [
      'Apagar documentos, a pasta media/ ou a base de dados do Paperless.',
      'Mudar a PAPERLESS_SECRET_KEY (desliga as sessões) sem o sim dele.',
    ],
  },
  [ConnectionProvider.SOLIDTIME]: {
    name: 'solidtime',
    before: [
      '🤖 O backup do MyHomeLab do solidtime (o export da organização) correu há pouco — prova: a hora do último bom',
      '🤖 As notas da versão nova não pedem passos à mão (migrações, mudanças no .env ou no docker-compose) — prova: o excerto das notas',
    ],
    after: [
      '🤖 O /health-check/up responde e o solidtime_overview mostra a organização — prova: a resposta',
      '🤖 As horas da semana estão lá, com os mesmos totais (solidtime_report) — prova: os números',
    ],
    never: [
      'Apagar a base de dados do solidtime, registos de horas ou projetos.',
      'Mudar a APP_KEY ou as chaves do Passport (deixam de valer os tokens e as sessões).',
    ],
  },
  [ConnectionProvider.STIRLING_PDF]: {
    name: 'Stirling-PDF',
    before: [
      '🤖 O backup do MyHomeLab do Stirling-PDF (as definições) correu há pouco — prova: a hora do último bom',
      '🤖 As notas da versão nova não pedem passos à mão (mudanças no docker-compose, no ambiente ou nas definições) — prova: o excerto das notas',
    ],
    after: [
      '🤖 O Stirling-PDF responde com a versão nova (stirling_overview) — prova: a versão',
      '🤖 As operações continuam lá, com o mesmo número, e uma corre bem (stirling_run numa operação simples, ex.: misc/compress-pdf) — prova: o resultado',
    ],
    never: [
      'Substituir ou apagar o documento original no Paperless ou no Nextcloud: o resultado vai sempre como ficheiro novo.',
      'Mudar segredos ou o login do Stirling-PDF (chaves de API, palavras-passe, OAuth).',
    ],
  },
  [ConnectionProvider.PLANE]: {
    name: 'Plane',
    before: [
      '🤖 Há um backup recente da base de dados do Plane (o PostgreSQL dele) — prova: a data do backup',
      '🤖 As notas da versão nova não pedem passos à mão (migrações, mudanças no .env ou no docker-compose) — prova: o excerto das notas',
    ],
    after: [
      '🤖 O /api/instances/ responde com a versão nova e o plane_overview mostra os projetos — prova: a versão e os números',
      '🤖 Uma tarefa abre bem (plane_get numa chave conhecida) — prova: a resposta',
    ],
    never: [
      'Apagar projetos, tarefas ou a base de dados do Plane.',
      'Mudar a SECRET_KEY nem as chaves do armazenamento (deixam de valer as sessões e os anexos).',
    ],
  },
  [ConnectionProvider.GITEA_MIRROR]: {
    name: 'Gitea Mirror',
    before: [
      '🤖 Há uma cópia da pasta de dados do Gitea Mirror (a base SQLite) — prova: a data da cópia',
      '🤖 As notas da versão nova não pedem passos à mão (variáveis de ambiente ou migrações) — prova: o excerto das notas',
    ],
    after: [
      '🤖 O /api/health responde ok com a versão nova (gitea_mirror_overview) — prova: a resposta',
      '🤖 Os repositórios estão lá, com o mesmo número, e não há falhas novas — prova: os números',
    ],
    never: [
      'Apagar repositórios ou espelhos no Gitea/Forgejo.',
      'Mudar os tokens do GitHub ou do Gitea guardados no Gitea Mirror.',
    ],
  },
  [ConnectionProvider.JELLYFIN]: {
    name: 'Jellyfin',
    before: [
      '🤖 Há um backup recente da configuração do Jellyfin (o do MyHomeLab) e, se for uma versão grande (ex.: 10.11 → 12), um backup completo do próprio Jellyfin ou da pasta de dados — prova: a data do backup',
      '🤖 As notas da versão nova não pedem passos à mão (migração da base de dados, plugins a tirar antes, procura completa depois) — prova: o excerto das notas',
      '🤖 Ninguém está a ver (jellyfin_sessions) — prova: a lista vazia',
    ],
    after: [
      '🤖 O /System/Info/Public responde com a versão nova e o jellyfin_overview mostra as bibliotecas com os números de antes — prova: a versão e os números',
      '🤖 As tarefas agendadas não falharam desde a atualização e os plugins estão ativos (jellyfin_overview, jellyfin_activity com problemsOnly) — prova: a resposta',
      'Se as notas o pedirem, correr uma procura completa nas bibliotecas (jellyfin_scan) e ver que acaba bem',
    ],
    never: [
      'Apagar bibliotecas, itens ou a pasta de dados do Jellyfin.',
      'Apagar utilizadores ou tirar o último administrador sem ele pedir.',
      'Mudar as chaves de API, o certificado HTTPS ou as definições de rede (o endereço pode deixar de responder).',
    ],
  },
  [ConnectionProvider.DISPATCHARR]: {
    name: 'Dispatcharr',
    before: [
      '🤖 Há um backup recente do Dispatcharr (o zip dele, guardado pelo MyHomeLab) — prova: a data do backup',
      '🤖 As notas da versão nova não pedem passos à mão (migrações, variáveis novas no docker-compose, mudanças no Redis/PostgreSQL) — prova: o excerto das notas',
      '🤖 Ninguém está a ver (dispatcharr_connections) e não há gravação a decorrer (dispatcharr_recordings) — prova: as listas',
    ],
    after: [
      '🤖 O /api/core/version/ responde com a versão nova e o dispatcharr_overview mostra os mesmos canais e streams de antes — prova: a versão e os números',
      '🤖 As contas M3U e as fontes de EPG não ficaram com erro (dispatcharr_overview) — prova: os estados',
      '🤖 Um canal abre bem pelo proxy (dispatcharr_connections enquanto alguém vê, ou o leitor) — prova: a resposta',
    ],
    never: [
      'Apagar canais, contas M3U, fontes de EPG ou gravações sem ele pedir.',
      'Restaurar um backup por cima do que está (substitui a base de dados toda).',
      'Mudar as credenciais dos fornecedores IPTV nem as chaves de API.',
    ],
  },
  [ConnectionProvider.COOLIFY]: {
    name: 'Coolify',
    before: [
      '🤖 Antes de um deploy, um stop ou de mudar uma variável no Coolify, diz-lhe qual a app (nome e uuid) e o que vai acontecer.',
    ],
    after: [
      '🤖 Depois de um deploy no Coolify, confirma o fim com coolify_deployments e, se falhou, mostra as últimas linhas do log.',
    ],
    never: [
      'Nunca mostrar valores de variáveis de ambiente do Coolify sem ele pedir esse valor.',
      'Nunca parar uma app no Coolify sem ele pedir.',
    ],
  },
  [ConnectionProvider.NGINX_PROXY_MANAGER]: {
    name: 'Nginx Proxy Manager',
    before: [
      '🤖 Antes de criar, mudar, desligar ou apagar um proxy host no Nginx Proxy Manager, diz-lhe o domínio e o destino; para apagar, espera pela confirmação dele.',
    ],
    after: [
      '🤖 Depois de mexer num proxy host, confirma com nginx_proxy_manager_host que o nginx ficou sem erro.',
    ],
    never: [
      'Nunca apagar um proxy host sem ele confirmar (desligar é reversível, apagar não).',
      'Nunca tirar o SSL ou a lista de acesso de um host sem ele pedir.',
    ],
  },
  [ConnectionProvider.CLICKHOUSE]: {
    name: 'ClickHouse',
    before: [
      '🤖 Há um backup do esquema do ClickHouse de hoje (Apps ligadas → ClickHouse → Backups) e, para os dados, um BACKUP do ClickHouse ou do CT — prova: a hora do último bom',
      '🤖 As notas da versão nova não trazem mudanças incompatíveis (Backward Incompatible Change) que toquem nas tabelas ou definições usadas — prova: o excerto das notas',
    ],
    after: [
      '🤖 O ClickHouse responde com a versão nova e todas as bases estão lá (clickhouse_overview) — prova: a versão e as bases',
      '🤖 Não há erros novos nem tabelas só de leitura (clickhouse_health) — prova: a resposta',
    ],
    never: [
      'Apagar bases de dados ou tabelas (DROP/TRUNCATE) sem ele confirmar.',
      'Mudar utilizadores, passwords ou grants do ClickHouse sem ele pedir.',
    ],
  },
  [ConnectionProvider.POSTGRES]: {
    name: 'PostgreSQL',
    before: [
      '🤖 Há um backup (pg_dump) de cada base importante de hoje, e um snapshot do CT/VM antes de mudar de versão major — prova: a hora do último bom',
      '🤖 As notas da versão nova não pedem passos à mão (pg_upgrade/dump e restore num major novo, REINDEX, extensões a atualizar) — prova: o excerto das notas',
    ],
    after: [
      '🤖 O PostgreSQL responde com a versão nova e todas as bases estão lá (postgres_overview) — prova: a versão e as bases',
      '🤖 As apps que usam este PostgreSQL voltaram a ligar-se (postgres_activity) — prova: as ligações por base',
    ],
    never: [
      'Apagar bases de dados, esquemas ou tabelas (DROP/TRUNCATE) sem ele confirmar.',
      'Mudar papéis, passwords ou o pg_hba.conf sem ele pedir.',
      'Fechar ligações (pg_terminate_backend) das apps sem ele confirmar.',
    ],
  },
  [ConnectionProvider.VAULTWARDEN]: {
    name: 'Vaultwarden',
    before: [
      '🤖 Há uma cópia recente da pasta data do Vaultwarden (com SQLite, vaultwarden_backup_db; ou o backup do CT/VM) — prova: a data da cópia',
      '🤖 As notas da versão nova não pedem passos à mão (variáveis de ambiente, migrações, versão mínima dos clientes) — prova: o excerto das notas',
    ],
    after: [
      '🤖 O /api/version responde com a versão nova e o painel abre (vaultwarden_overview) — prova: a resposta',
      '🤖 Os utilizadores e as organizações estão lá, com os mesmos números — prova: os números',
    ],
    never: [
      'Pedir ou guardar a password mestra de alguém, ou tentar ler os cofres.',
      'Apagar utilizadores ou organizações durante uma atualização.',
      'Mudar ou mostrar o ADMIN_TOKEN.',
    ],
  },
  [ConnectionProvider.INFISICAL]: {
    name: 'Infisical',
    before: [
      '🤖 Há um backup recente do Infisical (o JSON dos segredos e, de preferência, um pg_dump da base de dados dele) — prova: a data do backup',
      '🤖 As notas da versão nova não pedem passos à mão (migrações, variáveis de ambiente, ENCRYPTION_KEY) — prova: o excerto das notas',
    ],
    after: [
      '🤖 O /api/status responde "Ok" e a identidade continua a entrar (infisical_overview) — prova: a resposta',
      '🤖 Os projetos e o número de segredos por ambiente são os mesmos — prova: os números',
    ],
    never: [
      'Mostrar valores de segredos sem ele pedir, ou copiá-los para documentos, tarefas ou mensagens.',
      'Mudar a ENCRYPTION_KEY ou a AUTH_SECRET do servidor (os segredos deixam de se ler).',
      'Apagar segredos, pastas ou ambientes durante uma atualização.',
    ],
  },
  [ConnectionProvider.HOME_ASSISTANT]: {
    name: 'Home Assistant',
    before: [
      '👤 Eu disse que sim a esta versão (as automações da casa dependem dele): pergunta-se no estudo; eu pô-la em Ready to update conta como sim — prova: a minha resposta',
      '🤖 Nenhuma integração que uso aparece nas "Breaking changes" — prova: as integrações vistas',
    ],
    after: [
      '🤖 Todas as integrações carregam e as automações principais estão ativas — prova: o que se viu',
      '🤖 Os sensores e os dispositivos têm dados recentes — prova: a hora dos últimos dados',
    ],
    never: ['Desinstalar integrações ou add-ons durante uma atualização.'],
  },
  [ConnectionProvider.NEXTCLOUD]: {
    name: 'Nextcloud',
    backup: NEXTCLOUD_BACKUP,
    before: [
      '🤖 Não salta versões major: do Nextcloud só se sobe uma major de cada vez (ex.: 30 → 31, nunca 30 → 32) — prova: a versão de partida e a de chegada',
      '🤖 Todas as apps ligadas aceitam a versão nova (a App Store diz as versões do servidor de cada app); as que não aceitam ficam desligadas pelo Nextcloud — prova: as apps vistas ou "todas aceitam"',
      '🤖 O cron do Nextcloud corre e não há avisos graves (occ setupchecks) — prova: o que se viu',
    ],
    after: [
      '🤖 O status.php diz a versão nova, sem manutenção nem atualização da base de dados por fazer — prova: o JSON',
      '🤖 Correu o occ db:add-missing-indices e, se as notas o pedirem, o occ maintenance:repair — prova: a saída',
      '🤖 O login funciona, os ficheiros abrem e o calendário e as tarefas sincronizam — prova: o que se viu',
    ],
    never: [
      'Apagar a pasta de dados, a base de dados ou o config.php.',
      'Desinstalar apps (só desligar, e só se eu disser).',
      'Deixar o Nextcloud em modo de manutenção no fim.',
    ],
  },
  [ConnectionProvider.FORGEJO]: {
    name: 'Forgejo',
    before: [
      '🤖 Não há CI a correr (forgejo_list_action_runs) — prova: as corridas vistas',
      '🤖 Li o guia de migração das versões pelo meio (a base de dados não volta atrás sem o snapshot) — prova: as versões lidas',
    ],
    after: [
      '🤖 A página abre um repositório e um git ls-remote funciona — prova: o que se viu',
      '🤖 Os runners continuam ligados e um workflow corre — prova: o estado dos runners',
    ],
    never: ['Apagar repositórios, a base de dados ou os runners.'],
  },
};

const checklist = (items: string[]) =>
  items.map((item) => `- [ ] ${item}`).join('\n');

/** O documento de regras de uma app do servidor: onde corre, como se atualiza, antes e depois. */
export function appRulesContent(
  provider: ConnectionProvider,
  label: string,
  where?: string,
): string | null {
  const rules = APP_RULES[provider];
  if (!rules) return null;
  return `# ${label} – regras

**Onde corre:** ${where ?? '_a confirmar (o servidor e o CT/VM) — o agente propõe ao estudar._'}

**Como atualizar** (os comandos, tal como correm no servidor Proxmox; se algo falhar, volta-se ao snapshot):

\`\`\`bash
# a confirmar — ex.: pct exec 105 -- bash -lc 'cd /opt/app && docker compose pull && docker compose up -d'
\`\`\`

${CHECK_LEGEND}

## Antes de atualizar
${checklist([...BEFORE, ...(rules.backup ? [rules.backup] : []), ...rules.before])}

## Depois de atualizar
${checklist([...AFTER_START, ...rules.after, ...AFTER_END])}

## Nunca
${rules.never.map((item) => `- ${item}`).join('\n')}
`;
}

/** As atualizações dentro do Home Assistant (add-ons, HACS, firmware): sem snapshot, com o backup do HA. */
export function homeAssistantPartsContent(label: string): string {
  return `# ${label} – peças (add-ons, HACS, firmware)

Para as atualizações **dentro** do Home Assistant: add-ons, HACS (integrações e cards), firmware e outras integrações. O Core e o OS seguem as regras do Home Assistant.

**Como atualizar:** pelo próprio Home Assistant, \`update.install\` com \`backup: true\`. Sem snapshot da VM: chega o backup do Home Assistant. Se correr mal, volta-se à versão anterior ou ao backup (dizer-me antes de restaurar).

${CHECK_LEGEND}

## Antes de atualizar
- [ ] 🤖 Há um backup do Home Assistant feito pelo MyHomeLab há menos de 2 horas e sem erro. Se não houver, corre-o (run_backup) e espera que acabe bem — prova: a hora e o ficheiro do backup
- [ ] 🤖 Li as notas entre a versão instalada e a nova — prova: as versões lidas
- [ ] 🤖 A versão saiu há pelo menos 3 dias e não há issues graves abertas — prova: a data e os links vistos
- [ ] 👤 Se é um salto de versão major, eu disse que sim — prova: a minha resposta ou "não é major"
- [ ] 🤖 Sei o que usa esta peça (automações, painéis, dispositivos) — prova: os nomes ou "nada"

## Depois de atualizar
- [ ] 🤖 A versão nova aparece instalada no Home Assistant — prova: a versão
- [ ] 🤖 A peça carrega sem erros novos nos logs — prova: as linhas vistas ou "nenhuma"
- [ ] 🤖 O que a usa continua a funcionar (cards, automações, dispositivos) — prova: o que se viu

## Nunca
- Desinstalar add-ons ou integrações, ou mexer na configuração deles, sem me perguntar.
`;
}

/** As apps dentro do Nextcloud (Calendar, Tasks, Talk…): uma atualização por app, com o occ e snapshot. */
export function nextcloudAppsContent(label: string): string {
  return `# ${label} – apps (peças)

Para as atualizações **das apps dentro** do Nextcloud (Calendar, Tasks, Contacts, Talk…): cada app com versão nova na App Store é uma atualização à parte. O próprio Nextcloud segue as regras do Nextcloud.

**Onde corre:** a máquina do Nextcloud, CT ou VM (Apps ligadas → Nextcloud → Onde corre).

**Como atualizar** (no servidor Proxmox, com snapshot antes; se algo falhar, volta-se ao snapshot):

\`\`\`bash
# a confirmar o caminho do occ — num CT: pct exec <vmid> -- runuser -u www-data -- php /var/www/nextcloud/occ app:update <app>
# numa VM (precisa do qemu-guest-agent; sem --timeout desiste aos 30 s): qm guest exec <vmid> --timeout 300 -- runuser -u www-data -- php /var/www/nextcloud/occ app:update <app>
\`\`\`

${CHECK_LEGEND}

## Antes de atualizar
- [ ] 🤖 Li as notas entre a versão instalada e a nova (a ficha da app na App Store e o repositório dela) — prova: as versões lidas
- [ ] 🤖 A versão saiu há pelo menos 3 dias e não há issues graves abertas — prova: a data e os links vistos
- [ ] 🤖 A versão nova aceita a versão do Nextcloud instalada — prova: a versão do servidor e o que a App Store diz
- [ ] 🤖 O Nextcloud responde e não está em manutenção — prova: o status.php

## Depois de atualizar
- [ ] 🤖 A app aparece na versão nova (occ app:list) — prova: a versão
- [ ] 🤖 O Nextcloud não ficou em manutenção e os logs não têm erros novos da app — prova: o status.php e as linhas vistas ou "nenhuma"
- [ ] 🤖 O que a app faz continua a funcionar (ex.: o calendário sincroniza, as tarefas abrem) — prova: o que se viu

## Nunca
- Desinstalar ou desligar apps sem me perguntar.
- Atualizar o próprio Nextcloud junto com uma app.
`;
}

/**
 * Os documentos sugeridos para começar: as regras gerais, os processos gerais (como a
 * equipa trabalha, as atualizações, um serviço em baixo…) e um documento de regras por
 * cada app ligada que tem versão. Os mapas não se sugerem: escreve-os o agente ao estudar.
 */
export function starterDocs(
  apps: { id: string; provider: ConnectionProvider; label: string }[],
): StarterDoc[] {
  const docs = [GENERAL_RULES, ...PROCESS_DOCS];
  for (const app of apps) {
    const rules = APP_RULES[app.provider];
    const content = appRulesContent(app.provider, app.label);
    if (!rules || !content) continue;
    const links = [
      { type: DocLinkType.APP, targetId: app.id, label: app.label },
    ];
    docs.push({
      title: `${app.label} – regras`,
      kind: DocKind.RULES,
      tags: ['atualizacao', rules.name.toLowerCase()],
      summary: `Onde corre o ${rules.name}, como se atualiza e o que verificar antes e depois.`,
      links,
      content,
    });
    if (app.provider === ConnectionProvider.HOME_ASSISTANT) {
      docs.push({
        title: `${app.label} – peças (add-ons, HACS, firmware)`,
        kind: DocKind.RULES,
        tags: ['atualizacao', 'home assistant', 'pecas'],
        summary:
          'As atualizações dentro do Home Assistant (add-ons, HACS, firmware): backup do HA com menos de 2 h, sem snapshot da VM.',
        links,
        content: homeAssistantPartsContent(app.label),
      });
    }
    if (app.provider === ConnectionProvider.NEXTCLOUD) {
      docs.push({
        title: `${app.label} – apps (peças)`,
        kind: DocKind.RULES,
        tags: ['atualizacao', 'nextcloud', 'pecas'],
        summary:
          'As atualizações das apps dentro do Nextcloud: uma por app, com occ app:update na máquina (CT ou VM) e snapshot antes.',
        links,
        content: nextcloudAppsContent(app.label),
      });
    }
  }
  return docs;
}
