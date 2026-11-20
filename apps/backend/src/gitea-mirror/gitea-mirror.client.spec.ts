import { createGiteaMirrorClient } from './gitea-mirror.client';
import { pickRepositories } from 'src/assistant/toolsets/gitea-mirror-tools';

const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('gitea mirror client', () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  afterEach(() => fetchMock.mockReset());

  it('posts jobs as JSON with the key', async () => {
    fetchMock.mockImplementationOnce(() => reply({ success: true }));
    await createGiteaMirrorClient('https://m.example.com/', 'gm_x').job(
      'sync-repo',
      ['1'],
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://m.example.com/api/job/sync-repo');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      'x-api-key': 'gm_x',
      'Content-Type': 'application/json',
    });
    expect(init?.body).toBe(JSON.stringify({ repositoryIds: ['1'] }));
  });

  it('says when the key is read only', async () => {
    fetchMock.mockImplementationOnce(() =>
      reply({ success: false, code: 'API_KEY_READ_ONLY', error: 'ro' }, 403),
    );
    await expect(
      createGiteaMirrorClient('https://m.example.com', 'gm_x').importAll(),
    ).rejects.toThrow('só de leitura');
  });

  it('finds repositories by full name or a unique short name', () => {
    const repo = (fullName: string) => ({
      id: fullName,
      fullName,
      name: fullName.split('/')[1],
      owner: '',
      status: 'mirrored',
    });
    const all = [repo('a/web'), repo('b/web'), repo('a/api')];
    expect(
      pickRepositories(all, ['A/Web', 'api']).map((item) => item.id),
    ).toEqual(['a/web', 'a/api']);
    expect(() => pickRepositories(all, ['web'])).toThrow('há vários');
  });
});
