import { todoFromIcs, todoToIcs } from './nextcloud/nextcloudTasks.client';
import {
  nextcloudAppUpdates,
  nextcloudRoot,
} from 'src/nextcloud/nextcloud.client';

const ics = (lines: string[]) =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nextcloud Tasks',
    'BEGIN:VTODO',
    ...lines,
    'END:VTODO',
    'END:VCALENDAR',
  ].join('\r\n');

describe('tarefas do Nextcloud (iCalendar)', () => {
  it('lê o título, as notas, o prazo, a mãe e quando mudou', () => {
    const task = todoFromIcs(
      ics([
        'UID:abc',
        'SUMMARY:Comprar pão\\, leite',
        'DESCRIPTION:linha 1\\nlinha 2',
        'DUE;VALUE=DATE:20261110',
        'STATUS:NEEDS-ACTION',
        'RELATED-TO;RELTYPE=PARENT:mae',
        'LAST-MODIFIED:20261108T101500Z',
      ]),
    )!;
    expect(task).toMatchObject({
      id: 'abc',
      title: 'Comprar pão, leite',
      notes: 'linha 1\nlinha 2',
      dueDay: '2026-11-10',
      completed: false,
      parent: 'mae',
    });
    expect(task.updated.toISOString()).toBe('2026-11-08T10:15:00.000Z');
  });

  it('um prazo com hora em UTC conta o dia em Portugal', () => {
    const task = todoFromIcs(
      ics(['UID:a', 'SUMMARY:x', 'DUE:20260715T233000Z']),
    )!;
    expect(task.dueDay).toBe('2026-07-16');
  });

  it('feita ou cancelada lá conta como concluída', () => {
    expect(
      todoFromIcs(ics(['UID:a', 'SUMMARY:x', 'STATUS:COMPLETED']))!.completed,
    ).toBe(true);
    expect(
      todoFromIcs(ics(['UID:a', 'SUMMARY:x', 'STATUS:CANCELLED']))!.completed,
    ).toBe(true);
  });

  it('ao escrever, mantém o que não é dele e a hora de um prazo no mesmo dia', () => {
    const existing = ics([
      'UID:abc',
      'SUMMARY:Antes',
      'DUE:20261110T090000Z',
      'PRIORITY:1',
      'CATEGORIES:casa',
      'RELATED-TO;RELTYPE=PARENT:mae',
      'STATUS:IN-PROCESS',
    ]);
    const { ics: written } = todoToIcs(
      'abc',
      { title: 'Depois', notes: null, dueDay: '2026-11-10', completed: false },
      existing,
    );
    expect(written).toContain('SUMMARY:Depois');
    expect(written).toContain('DUE:20261110T090000Z');
    expect(written).toContain('PRIORITY:1');
    expect(written).toContain('CATEGORIES:casa');
    expect(written).toContain('RELATED-TO;RELTYPE=PARENT:mae');
    expect(written).toContain('STATUS:IN-PROCESS');
    expect(written).not.toContain('SUMMARY:Antes');
  });

  it('uma nova leva a mãe, o dia e o "feita"; o updated é o que fica escrito', () => {
    const { ics: written, updated } = todoToIcs(
      'nova',
      { title: 'Filha', notes: 'a;b', dueDay: '2026-12-01', completed: true },
      null,
      'mae',
    );
    const task = todoFromIcs(written)!;
    expect(task).toMatchObject({
      id: 'nova',
      title: 'Filha',
      notes: 'a;b',
      dueDay: '2026-12-01',
      completed: true,
      parent: 'mae',
    });
    expect(task.updated.getTime()).toBe(updated.getTime());
    expect(written).toContain('DUE;VALUE=DATE:20261201');
  });
});

describe('Nextcloud: raiz e apps com versão nova', () => {
  it('tira o /remote.php/… do endereço', () => {
    expect(nextcloudRoot('https://nc.casa/remote.php/dav/')).toBe(
      'https://nc.casa',
    );
    expect(nextcloudRoot('https://nc.casa/nextcloud/')).toBe(
      'https://nc.casa/nextcloud',
    );
  });

  it('só as apps instaladas com versão mais alta na App Store', () => {
    const store = new Map([
      [
        'calendar',
        {
          id: 'calendar',
          name: 'Calendar',
          latest: '5.1.0',
          website: null,
          issueTracker: null,
          releases: [],
        },
      ],
      [
        'tasks',
        {
          id: 'tasks',
          name: 'Tasks',
          latest: '0.16.1',
          website: null,
          issueTracker: null,
          releases: [],
        },
      ],
    ]);
    const updates = nextcloudAppUpdates(
      [
        { id: 'calendar', name: 'Calendar', version: '5.0.9' },
        { id: 'tasks', name: 'Tasks', version: '0.16.1' },
        { id: 'files', name: 'Files', version: '2.0.0' },
      ],
      store,
    );
    expect(updates).toEqual([
      expect.objectContaining({
        id: 'calendar',
        installed: '5.0.9',
        latest: '5.1.0',
      }),
    ]);
  });
});
