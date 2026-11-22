import { AppIntegrationError } from './app-integration.error';
import { describeFetchError, isVersionString, parseAppJson } from './app-fetch';
import { latestGithubRelease } from './releases';

describe('app-fetch', () => {
  it('explains the real cause of "fetch failed"', () => {
    const failed = (code: string) =>
      new TypeError('fetch failed', { cause: { code } });
    expect(describeFetchError(failed('DEPTH_ZERO_SELF_SIGNED_CERT'))).toMatch(
      /self-signed/,
    );
    expect(describeFetchError(failed('ECONNREFUSED'))).toMatch(/porta/);
    expect(describeFetchError(failed('ENOTFOUND'))).toMatch(/nome/);
    expect(
      describeFetchError(new DOMException('timeout', 'TimeoutError')),
    ).toMatch(/a tempo/);
  });

  it('refuses an HTML page as data', () => {
    expect(() =>
      parseAppJson('<!DOCTYPE html><html></html>', 'Plane', 'a instância'),
    ).toThrow(AppIntegrationError);
    expect(() =>
      parseAppJson('<!DOCTYPE html><html></html>', 'Plane', 'a instância'),
    ).toThrow(/HTML/);
    expect(parseAppJson('{"a":1}', 'Plane', 'x')).toEqual({ a: 1 });
    expect(parseAppJson('', 'Plane', 'x')).toEqual({});
  });

  it('only accepts real versions', () => {
    expect(isVersionString('v4.7.6')).toBe(true);
    expect(isVersionString('2024.10.1')).toBe(true);
    expect(isVersionString('<!DOCTYPE html>')).toBe(false);
    expect(isVersionString('')).toBe(false);
    expect(isVersionString(null)).toBe(false);
  });
});

describe('latestGithubRelease', () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  afterEach(() => fetchMock.mockReset());

  it('remembers a failure instead of asking GitHub again', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 403 }));
    await expect(latestGithubRelease('exemplo/falha')).rejects.toThrow('403');
    await expect(latestGithubRelease('exemplo/falha')).rejects.toThrow('403');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
