import {
  createDispatcharrClient,
  dispatcharrVersion,
  normalizeDispatcharrUrl,
} from './dispatcharr.client';

const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('dispatcharr client', () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  afterEach(() => fetchMock.mockReset());

  it('cleans the address', () => {
    expect(normalizeDispatcharrUrl('https://tv.example.com/api/swagger/')).toBe(
      'https://tv.example.com',
    );
    expect(normalizeDispatcharrUrl('https://tv.example.com/channels#x')).toBe(
      'https://tv.example.com',
    );
  });

  it('sends the key and reads a page of channels', async () => {
    fetchMock.mockImplementationOnce(() =>
      reply({ count: 2, results: [{ id: 1, name: 'RTP1' }] }),
    );
    const { items, total } = await createDispatcharrClient(
      'https://tv.example.com/',
      'dk_1',
    ).channels({ search: 'rtp', limit: 10 });
    expect(items[0].name).toBe('RTP1');
    expect(total).toBe(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://tv.example.com/api/channels/channels/?search=rtp&ordering=channel_number&page=1&page_size=10',
    );
    expect(init?.headers).toMatchObject({ 'X-API-Key': 'dk_1' });
  });

  it('reads the version without a key', async () => {
    fetchMock.mockImplementationOnce(() => reply({ version: '0.34.1' }));
    await expect(dispatcharrVersion('https://tv.example.com')).resolves.toBe(
      'v0.34.1',
    );
  });

  it('says when the key is not from an admin', async () => {
    fetchMock.mockImplementationOnce(() =>
      reply({ detail: 'You do not have permission' }, 403),
    );
    await expect(
      createDispatcharrClient('https://tv.example.com', 'dk_1').m3uAccounts(),
    ).rejects.toThrow('administrador');
  });

  it('waits for the backup task to finish', async () => {
    fetchMock
      .mockImplementationOnce(() => reply({ task_id: 't1' }, 202))
      .mockImplementationOnce(() => reply({ state: 'started' }))
      .mockImplementationOnce(() =>
        reply({
          state: 'completed',
          result: { status: 'completed', filename: 'dispatcharr-backup-1.zip' },
        }),
      );
    await expect(
      createDispatcharrClient('https://tv.example.com', 'dk_1').createBackup(
        5_000,
        1,
      ),
    ).resolves.toBe('dispatcharr-backup-1.zip');
  });
});
