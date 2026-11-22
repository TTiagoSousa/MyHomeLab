// Cria uma migração nova a partir do diff entre a base de dados e o schema.prisma:
//   npm run migration:new -w @myhomelab/backend -- <nome_curto>
// O prefixo é sempre maior do que o da última migração (o Prisma aplica-as por ordem do
// nome): há migrações com datas à frente do relógio, e uma com a data de hoje ficaria
// antes delas e partiria numa instalação nova.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const name = process.argv[2];
if (!name || !/^[a-z0-9_]+$/.test(name)) {
  console.error('Uso: npm run migration:new -- <nome_curto> (letras minúsculas, números e _)');
  process.exit(1);
}

const dir = join('prisma', 'migrations');
const stamp = (date) => date.toISOString().replace(/\D/g, '').slice(0, 14);
const last = readdirSync(dir).filter((entry) => /^\d{14}_/.test(entry)).sort().at(-1);
const now = stamp(new Date());
let prefix = now;
if (last && last.slice(0, 14) >= now) {
  const [y, mo, d, h, mi, s] = last.slice(0, 14).match(/(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)/).slice(1).map(Number);
  prefix = stamp(new Date(Date.UTC(y, mo - 1, d, h, mi + 1, s)));
}

const prisma = createRequire(import.meta.url).resolve('prisma/build/index.js');
const sql = execFileSync(
  process.execPath,
  [prisma, 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--script'],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter((line) => !line.startsWith('Loaded Prisma config'))
  .join('\n')
  .trim();
if (!sql || sql === '-- This is an empty migration.') {
  console.error('O schema não tem diferenças em relação à base de dados: nada a criar.');
  process.exit(1);
}

const folder = join(dir, `${prefix}_${name}`);
if (existsSync(folder)) {
  console.error(`${folder} já existe.`);
  process.exit(1);
}
mkdirSync(folder);
writeFileSync(join(folder, 'migration.sql'), `${sql}\n`);
console.log(`✓ ${folder}/migration.sql — revê o SQL e aplica com: npx prisma migrate deploy`);
