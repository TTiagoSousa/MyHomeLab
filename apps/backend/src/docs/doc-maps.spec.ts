import { labelTree, NOTES_HEADING, withNotes } from './maps/mapContent';
import { appMap, serverMap } from './maps/mapBuilders';

describe('withNotes', () => {
  it('um mapa novo traz o espaço para as Notas', () => {
    const text = withNotes('Mapa – X', ['## A app\n\n- **App:** X']);
    expect(text.startsWith('# Mapa – X')).toBe(true);
    expect(text).toContain(NOTES_HEADING);
  });

  it('refazer o mapa guarda as Notas tal como estavam', () => {
    const before = `# Mapa – X\n\n## A app\n\n- velho\n\n${NOTES_HEADING}\n\nA conta invest é só para corretoras.\n\n### Contactos\n- suporte`;
    const after = withNotes('Mapa – X', ['## A app\n\n- novo'], before);
    expect(after).toContain('- novo');
    expect(after).not.toContain('- velho');
    expect(
      after.endsWith(
        `${NOTES_HEADING}\n\nA conta invest é só para corretoras.\n\n### Contactos\n- suporte`,
      ),
    ).toBe(true);
  });
});

describe('labelTree', () => {
  it('agrupa os marcadores por baixo do de topo', () => {
    expect(
      labelTree([
        'Saúde/Rex',
        'Bancos',
        'Saúde',
        'Saúde/Oli/Veterinário especial',
      ]),
    ).toEqual(['- **Bancos**', '- **Saúde:** Oli/Veterinário especial, Rex']);
  });
});

describe('serverMap', () => {
  it('lista as máquinas com as apps que correm em cada uma, sem os modelos', () => {
    const text = serverMap('Mapa – HomeLab', {
      name: 'HomeLab',
      host: '192.0.2.10',
      port: 8006,
      sshEnabled: true,
      version: '9.1',
      nodes: [
        { node: 'pve', status: 'online', maxcpu: 8, maxmem: 32 * 1024 ** 3 },
      ],
      guests: [
        {
          vmid: 105,
          kind: 'lxc',
          name: 'adguard',
          node: 'pve',
          status: 'running',
          maxcpu: 1,
          maxmem: 512 * 1024 ** 2,
          maxdisk: 4 * 1024 ** 3,
          template: false,
        },
        {
          vmid: 9000,
          kind: 'qemu',
          name: 'modelo',
          node: 'pve',
          template: true,
        },
      ],
      storages: [],
      apps: [{ label: 'AdGuard', vmid: 105 }],
      monitors: ['AdGuard (ping)'],
    });
    expect(text).toContain(
      '| 105 | CT | adguard | pve | running | 1 | 0.5 GB | 4.0 GB | AdGuard |',
    );
    expect(text).not.toContain('modelo');
    expect(text).toContain('- AdGuard — na máquina 105');
    expect(text).toContain('versão 9.1');
  });

  it('diz quando o Proxmox não respondeu', () => {
    const text = serverMap('Mapa – HomeLab', {
      name: 'HomeLab',
      host: 'h',
      port: 8006,
      sshEnabled: false,
      nodes: [],
      guests: [],
      storages: [],
      apps: [],
      monitors: [],
      error: 'timeout',
    });
    expect(text).toContain(
      'Não consegui ler o Proxmox nesta passagem (timeout)',
    );
  });
});

describe('appMap', () => {
  it('o mapa do Gmail traz as regras, os marcadores e a caixa', () => {
    const text = appMap('Mapa – Gmail · eu@example.com', {
      app: 'Gmail',
      baseUrl: null,
      username: null,
      emailAddress: 'eu@example.com',
      isAdmin: false,
      version: null,
      latestVersion: null,
      checkedAt: null,
      runsOn: null,
      since: new Date('2026-11-01T10:00:00Z'),
      gmail: {
        rules: 154,
        activeRules: 150,
        frequency: 'HOURLY',
        lastRunAt: null,
        proposalFrequency: null,
        labels: ['Saúde/Rex', 'Saúde/Oli'],
        inboxTotal: 95,
        inboxUnread: 3,
        mailboxTotal: 12345,
      },
    });
    expect(text).toContain(
      '**154 regras** (150 ativas), correm de hora a hora',
    );
    expect(text).toContain('**Propostas de regras pela IA:** desligada');
    expect(text).toContain('- **Saúde:** Oli, Rex');
    expect(text).toContain('**95 conversas na caixa de entrada** (3 por ler)');
  });

  it('o de uma app diz a versão nova e onde corre', () => {
    const text = appMap('Mapa – Forgejo', {
      app: 'Forgejo',
      baseUrl: 'https://git.example.com',
      username: 'admin',
      emailAddress: null,
      isAdmin: true,
      version: '9.0.1',
      latestVersion: '9.0.2',
      checkedAt: null,
      runsOn: 'máquina 110 do servidor HomeLab',
      since: new Date('2026-11-01T10:00:00Z'),
    });
    expect(text).toContain('**Versão:** 9.0.1 (há a 9.0.2)');
    expect(text).toContain('**Utilizador ligado:** admin (administrador)');
    expect(text).toContain('**Onde corre:** máquina 110 do servidor HomeLab');
  });
});
