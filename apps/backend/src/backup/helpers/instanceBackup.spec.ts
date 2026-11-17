import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { tableFile } from './instanceAreas';
import { createLocalFiles } from './localFiles';

describe('backup do MyHomeLab', () => {
  let folder: string;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'mhl-spec-'));
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it('põe cada tabela na pasta da sua área (e as desconhecidas em outros/)', () => {
    expect(tableFile('Agent')).toBe('agentes/Agent.jsonl');
    expect(tableFile('Doc')).toBe('documentos/Doc.jsonl');
    expect(tableFile('BoardTask')).toBe('projetos/BoardTask.jsonl');
    expect(tableFile('ConnectedAccount')).toBe(
      'apps-ligadas/ConnectedAccount.jsonl',
    );
    expect(tableFile('AiCredential')).toBe('ia/AiCredential.jsonl');
    expect(tableFile('TabelaNova')).toBe('outros/TabelaNova.jsonl');
  });

  it('o destino local grava, lista, apaga e não sai da pasta', async () => {
    const files = createLocalFiles(folder);
    await files.ensureFolder('local', 'MyHomeLab');
    await files.upload('local', 'MyHomeLab/a.zip', Buffer.from('x'));
    expect(await files.list('local', 'MyHomeLab')).toEqual([
      { name: 'a.zip', sizeBytes: 1 },
    ]);
    expect(await readFile(join(folder, 'MyHomeLab', 'a.zip'), 'utf8')).toBe(
      'x',
    );
    await files.remove('local', 'MyHomeLab/a.zip');
    expect(await files.list('local', 'MyHomeLab')).toEqual([]);
    await expect(files.ensureFolder('local', '../fora')).rejects.toThrow();
  });
});
