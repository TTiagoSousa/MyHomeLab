import { ConnectedAccount } from 'src/generated/prisma/client/client';
import { planeBackup } from './planeBackup';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200 });

describe('planeBackup', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('junta os membros e, por projeto, os estados e as tarefas, e marca o que falhou', async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation((input) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (url.endsWith('/api/instances/')) {
          return Promise.resolve(
            json({ instance: { current_version: '1.2.0' } }),
          );
        }
        if (url.includes('/projects/?')) {
          return Promise.resolve(
            json({
              results: [{ id: 'p1', name: 'Web', identifier: 'WEB' }],
              next_page_results: false,
            }),
          );
        }
        if (url.endsWith('/members/')) {
          return Promise.resolve(json([{ id: 'u1', display_name: 'eu' }]));
        }
        if (url.includes('/modules/')) {
          return Promise.resolve(new Response('erro', { status: 500 }));
        }
        if (url.includes('/work-items/')) {
          return Promise.resolve(
            json({
              results: [{ id: 'w1', name: 'Tarefa', sequence_id: 1 }],
              next_page_results: false,
            }),
          );
        }
        return Promise.resolve(json({ results: [], next_page_results: false }));
      });

    const done = planeBackup({
      baseUrl: 'https://plane.exemplo.com',
      accessToken: 'chave',
      username: 'casa',
      displayName: 'Plane',
    } as ConnectedAccount);
    await jest.runAllTimersAsync();
    const file = await done;

    const body = JSON.parse(
      Buffer.from(file.content as Buffer).toString('utf8'),
    ) as {
      appVersion: string;
      workspace: string;
      data: {
        members: unknown[];
        projects: { identifier: string; workItems: unknown[] }[];
      };
    };
    expect(body.appVersion).toBe('v1.2.0');
    expect(body.workspace).toBe('casa');
    expect(body.data.members).toHaveLength(1);
    expect(body.data.projects[0].identifier).toBe('WEB');
    expect(body.data.projects[0].workItems).toHaveLength(1);
    expect(file.missing).toEqual(['WEB.modules']);
    const headers = fetchMock.mock.calls[1][1]?.headers as Record<
      string,
      string
    >;
    expect(headers['X-API-Key']).toBe('chave');
  });
});
