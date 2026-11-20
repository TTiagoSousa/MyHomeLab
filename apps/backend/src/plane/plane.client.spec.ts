import {
  createPlaneClient,
  normalizePlaneUrl,
  planeSlug,
} from './plane.client';
import { planeHtml } from 'src/assistant/toolsets/plane-tools';

const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('plane client', () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  afterEach(() => fetchMock.mockReset());

  it('reads the slug from a link or as typed', () => {
    expect(planeSlug('https://plane.example.com/my-team/projects/')).toBe(
      'my-team',
    );
    expect(planeSlug('My-Team')).toBe('my-team');
    expect(normalizePlaneUrl('https://plane.example.com/api/v1/')).toBe(
      'https://plane.example.com',
    );
  });

  it('sends the key and follows the cursor pages', async () => {
    fetchMock
      .mockImplementationOnce(() =>
        reply({
          results: [{ id: 'a' }],
          next_page_results: true,
          next_cursor: '100:1:0',
        }),
      )
      .mockImplementationOnce(() =>
        reply({ results: [{ id: 'b' }], next_page_results: false }),
      );
    const projects = await createPlaneClient(
      'https://plane.example.com',
      'key',
      'team',
    ).projects();
    expect(projects.map((project) => project.id)).toEqual(['a', 'b']);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(
      'https://plane.example.com/api/v1/workspaces/team/projects/?per_page=100&cursor=100%3A1%3A0',
    );
    expect((init?.headers as Record<string, string>)['X-API-Key']).toBe('key');
  });

  it('explains a refused token', async () => {
    fetchMock.mockImplementationOnce(() => reply({ detail: 'no' }, 401));
    await expect(
      createPlaneClient('https://p.example.com', 'bad', 't').me(),
    ).rejects.toThrow('recusou o token');
  });

  it('turns text into safe paragraphs', () => {
    expect(planeHtml('Olá <b>\nlinha\n\nfim')).toBe(
      '<p>Olá &lt;b&gt;<br>linha</p><p>fim</p>',
    );
  });
});
