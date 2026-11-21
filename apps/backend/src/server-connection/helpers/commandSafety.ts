/**
 * Só para o registo: se um comando apenas lê (logs, estado, configs) ou se altera.
 * Não decide nada — todos correm; o que se pode fazer está nas regras (documentos).
 * Na dúvida, é write: a lista de leitura é fechada.
 */
export type CommandClass = 'read' | 'write';

const SAFE_FILTERS = new Set([
  'grep',
  'egrep',
  'head',
  'tail',
  'wc',
  'sort',
  'uniq',
  'cut',
  'tr',
  'column',
  'cat',
]);

/** Os pedidos ao agente da VM ("qm guest cmd <vmid> <pedido>") que só leem. */
const GUEST_AGENT_READS = new Set([
  'info',
  'ping',
  'network-get-interfaces',
  'get-osinfo',
  'get-host-name',
  'get-fsinfo',
  'get-time',
  'get-timezone',
  'get-users',
  'get-vcpus',
  'get-memory-blocks',
  'get-memory-block-info',
]);

/** Os comandos do occ do Nextcloud ("php …/occ status") que só leem. */
const OCC_READS: Record<string, (args: string[]) => boolean> = {
  status: () => true,
  check: () => true,
  'app:list': () => true,
  'app:update': (args) => args.includes('--showonly'),
  'update:check': () => true,
  'db:schema:check': () => true,
  'log:file': (args) => args.every((arg) => arg.startsWith('--output')),
  'maintenance:mode': (args) => args.length === 0,
};

/** Só mostrar a versão ("forgejo --version", "/usr/sbin/nginx -V"). */
const VERSION_FLAGS = new Set(['--version', '-V']);

/** Um guião do sed que só imprime linhas: "18,80p", "$p", "5p". */
const SED_PRINT = /^(\d+|\$)(,(\d+|\$))?p$/;

type ArgsCheck = (args: string[]) => boolean;

const any: ArgsCheck = () => true;
const first =
  (...allowed: string[]): ArgsCheck =>
  (args) =>
    args.length > 0 && allowed.includes(args[0]);
const without =
  (...forbidden: string[]): ArgsCheck =>
  (args) =>
    !args.some((arg) =>
      forbidden.some((word) => arg === word || arg.startsWith(`${word}=`)),
    );

/** Uma flag curta, sozinha ou junta com outras ("-K", "-tnK"). */
const hasShortFlag = (args: string[], flag: string): boolean =>
  args.some((arg) => /^-[a-zA-Z]+$/.test(arg) && arg.includes(flag));

/** Os comandos que só leem, e com que argumentos. */
const READ_COMMANDS: Record<string, ArgsCheck> = {
  cat: any,
  ls: any,
  ll: any,
  // tree -o <ficheiro> escreve a árvore num ficheiro.
  tree: (args) =>
    !hasShortFlag(args, 'o') && !args.some((arg) => arg.startsWith('--output')),
  stat: any,
  file: any,
  readlink: any,
  realpath: any,
  head: any,
  tail: (args) => !args.includes('-f') && !args.includes('--follow'),
  grep: any,
  egrep: any,
  wc: any,
  sort: without('-o', '--output'),
  // uniq <entrada> <saída> escreve o resultado num ficheiro.
  uniq: (args) => args.filter((arg) => !arg.startsWith('-')).length <= 1,
  cut: any,
  column: any,
  // Por prefixo: -fprint0, -fprintf e -fls também escrevem ficheiros.
  find: (args) =>
    !args.some((arg) =>
      ['-delete', '-exec', '-ok', '-fprint', '-fls'].some((word) =>
        arg.startsWith(word),
      ),
    ),
  df: any,
  du: any,
  free: any,
  uptime: any,
  uname: any,
  hostname: (args) => args.every((arg) => arg.startsWith('-')),
  hostnamectl: (args) => args.length === 0 || args[0] === 'status',
  whoami: any,
  id: any,
  date: (args) => !args.some((arg) => arg === '-s' || arg.startsWith('--set')),
  ps: any,
  top: (args) => args.some((arg) => arg.startsWith('-b') || arg === '-bn1'),
  lscpu: any,
  lsblk: any,
  blkid: any,
  lspci: any,
  lsusb: any,
  lsof: any,
  sensors: any,
  findmnt: any,
  mount: (args) => args.length === 0 || args.every((arg) => arg === '-l'),
  dmesg: without(
    '-c',
    '-C',
    '--clear',
    '--read-clear',
    '-n',
    '--console-level',
  ),
  last: any,
  w: any,
  who: any,
  env: (args) => args.length === 0,
  printenv: any,
  getent: any,
  which: any,
  whereis: any,
  ip: (args) =>
    !args.some((arg) =>
      [
        'add',
        'del',
        'delete',
        'change',
        'replace',
        'set',
        'flush',
        'append',
      ].includes(arg),
    ),
  // ss -K fecha as ligações que mostra.
  ss: (args) => !hasShortFlag(args, 'K') && !args.includes('--kill'),
  netstat: any,
  ping: (args) => args.includes('-c'),
  dig: any,
  nslookup: any,
  systemctl: first(
    'status',
    'list-units',
    'list-unit-files',
    'list-timers',
    'is-active',
    'is-enabled',
    'is-failed',
    'show',
    'cat',
    '--failed',
  ),
  journalctl: without(
    '--vacuum-size',
    '--vacuum-time',
    '--vacuum-files',
    '--rotate',
    '--flush',
    '--sync',
    '--relinquish-var',
    '--smart-relinquish-var',
    '-f',
    '--follow',
  ),
  crontab: (args) => args.length === 1 && args[0] === '-l',
  pveversion: any,
  pvesh: first('get', 'ls'),
  pvesm: first('status', 'list', 'path'),
  pvecm: first('status', 'nodes'),
  'ha-manager': first('status', 'config'),
  pct: first('list', 'config', 'status', 'df', 'pending', 'listsnapshot'),
  qm: (args) =>
    first(
      'list',
      'config',
      'status',
      'pending',
      'listsnapshot',
      'showcmd',
    )(args) ||
    (args[0] === 'guest' &&
      args[1] === 'cmd' &&
      GUEST_AGENT_READS.has(args[3] ?? '')),
  zpool: first('status', 'list', 'iostat', 'get', 'history'),
  zfs: first('list', 'get'),
  smartctl: (args) =>
    args.some((arg) =>
      ['-a', '-H', '-i', '-x', '-A', '--all', '--health', '--info'].includes(
        arg,
      ),
    ) && !args.some((arg) => ['-s', '-t', '-X', '-o', '-S'].includes(arg)),
  apt: first('list', 'policy', 'show', 'search', 'depends', 'rdepends'),
  'apt-cache': any,
  'dpkg-query': any,
  dpkg: first('-l', '-L', '-s', '--list', '--listfiles', '--status', '-S'),
  docker: (args) =>
    first(
      'ps',
      'logs',
      'inspect',
      'images',
      'version',
      'info',
      'top',
      'port',
      'diff',
    )(args) ||
    (args[0] === 'stats' && args.includes('--no-stream')) ||
    (args[0] === 'compose' &&
      ['ls', 'ps', 'logs', 'config', 'images', 'top'].includes(
        args[1] ?? '',
      )) ||
    (['network', 'volume', 'container', 'image'].includes(args[0] ?? '') &&
      ['ls', 'inspect', 'list'].includes(args[1] ?? '')),
  sed: (args) =>
    args[0] === '-n' &&
    SED_PRINT.test(args[1] ?? '') &&
    args.slice(2).every((arg) => !arg.startsWith('-')),
  nginx: (args) =>
    args.length === 1 && ['-t', '-T', '-v', '-V'].includes(args[0]),
};

/** Separa um comando em palavras, respeitando aspas simples e duplas. */
function tokenize(command: string): string[] | null {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let has = false;
  for (const char of command) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      has = true;
    } else if (/\s/.test(char)) {
      if (has || current) tokens.push(current);
      current = '';
      has = false;
    } else {
      current += char;
      has = true;
    }
  }
  if (quote) return null;
  if (has || current) tokens.push(current);
  return tokens;
}

/** Um pedaço de pipeline só de leitura: o comando e os argumentos estão na lista. */
function isReadSegment(tokens: string[], filter: boolean): boolean {
  if (!tokens.length) return false;
  const [name, ...args] = tokens[0] === 'sudo' ? tokens.slice(1) : tokens;
  if (!name) return false;
  if (filter && !SAFE_FILTERS.has(name)) return false;

  // "pct exec 105 -- comando" e "docker exec x comando": vale o comando de dentro.
  if (name === 'pct' && args[0] === 'exec') {
    const inner = args.indexOf('--');
    return inner > 0 && isReadSegment(args.slice(inner + 1), false);
  }
  // "qm guest exec 101 --timeout 60 -- comando" e "runuser -u www-data -- comando": idem.
  if (
    (name === 'qm' && args[0] === 'guest' && args[1] === 'exec') ||
    name === 'runuser'
  ) {
    const inner = args.indexOf('--');
    return inner > 0 && isReadSegment(args.slice(inner + 1), false);
  }
  if (name === 'php' && args[0]?.endsWith('/occ')) {
    const check = OCC_READS[args[1] ?? ''];
    return Boolean(check?.(args.slice(2)));
  }
  if (name === 'docker' && args[0] === 'exec') {
    const rest = args.slice(1).filter((arg) => !arg.startsWith('-'));
    return rest.length > 1 && isReadSegment(rest.slice(1), false);
  }
  if (args.length === 1 && VERSION_FLAGS.has(args[0])) return true;
  const check = READ_COMMANDS[name];
  return Boolean(check?.(args));
}

/**
 * Os pedaços de um pipeline, separados pelos "|" fora de aspas, ou null quando há
 * redireções, encadeamentos ou substituições. Dentro de aspas simples nada conta;
 * dentro de aspas duplas só a substituição ($( e `), que o shell executa na mesma.
 */
function splitPipeline(command: string): string[] | null {
  const segments: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  for (let index = 0; index < command.length; index++) {
    const char = command[index];
    const next = command[index + 1];
    if (quote === "'") {
      if (char === "'") quote = null;
    } else if (quote === '"') {
      if (char === '"') quote = null;
      else if (char === '`' || (char === '$' && next === '(')) return null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (/[;&`<>\n]/.test(char) || (char === '$' && next === '(')) {
      return null;
    } else if (char === '|') {
      if (next === '|') return null;
      segments.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  segments.push(current);
  return segments;
}

export function classifyCommand(command: string): CommandClass {
  const trimmed = command.trim();
  if (!trimmed) return 'write';

  // Redireções, encadeamentos e substituições fazem de tudo um "write".
  const cleaned = trimmed
    .replace(/\s2>&1\b/g, ' ')
    .replace(/\s2>\/dev\/null\b/g, ' ');
  const segments = splitPipeline(cleaned);
  if (!segments) return 'write';

  const read = segments.every((segment, index) => {
    const tokens = tokenize(segment.trim());
    return tokens !== null && isReadSegment(tokens, index > 0);
  });
  return read ? 'read' : 'write';
}
