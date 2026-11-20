import {
  createJellyfinClient,
  jellyfinDuration,
  jellyfinVersion,
  normalizeJellyfinUrl,
} from './jellyfin.client';

const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('jellyfin client', () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  afterEach(() => fetchMock.mockReset());

  it('cleans the address and formats ticks', () => {
    expect(
      normalizeJellyfinUrl('https://media.example.com/web/#/dashboard'),
    ).toBe('https://media.example.com');
    expect(jellyfinDuration(55_250_000_000)).toBe('1:32:05');
  });

  it('sends the key in the MediaBrowser authorization header', async () => {
    fetchMock.mockImplementationOnce(() =>
      reply([{ Name: 'Filmes', ItemId: 'abc', CollectionType: 'movies' }]),
    );
    const libraries = await createJellyfinClient(
      'https://media.example.com/',
      'k123',
    ).libraries();
    expect(libraries[0].Name).toBe('Filmes');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://media.example.com/Library/VirtualFolders');
    expect((init?.headers as Record<string, string>).Authorization).toContain(
      'Token="k123"',
    );
  });

  it('reads the version without a key', async () => {
    fetchMock.mockImplementationOnce(() =>
      reply({ Version: '12.4.0', Id: 'x', ServerName: 'casa' }),
    );
    await expect(jellyfinVersion('https://media.example.com')).resolves.toBe(
      'v12.4.0',
    );
  });

  it('explains a refused key', async () => {
    fetchMock.mockImplementationOnce(() => reply({}, 401));
    await expect(
      createJellyfinClient('https://media.example.com', 'bad').users(),
    ).rejects.toThrow('Chaves de API');
  });
});
