import { BadRequestException } from '@nestjs/common';
import { ensureFreshAccessToken } from './ensureFreshAccessToken';

describe('ensureFreshAccessToken', () => {
  const fetchMock = jest.spyOn(global, 'fetch');
  afterEach(() => fetchMock.mockReset());

  const account = {
    id: 'a1',
    userId: 'u1',
    provider: 'GMAIL',
    emailAddress: 'eu@example.com',
    accessToken: null,
    refreshToken: 'refresh',
    tokenExpiresAt: null,
  };

  beforeAll(() => {
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
  });

  it('marks the account to reconnect when Google revoked the access', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }),
    );
    const repository = {
      findById: jest.fn().mockResolvedValue(account),
      markNeedsReconnect: jest.fn().mockResolvedValue(undefined),
      update: jest.fn(),
    };

    const result = ensureFreshAccessToken('a1', repository as never);

    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.markNeedsReconnect).toHaveBeenCalledWith(
      account,
      expect.stringContaining('Volta a ligá-la'),
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('does not mark the account on another Google failure', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    const repository = {
      findById: jest.fn().mockResolvedValue(account),
      markNeedsReconnect: jest.fn(),
      update: jest.fn(),
    };

    await expect(
      ensureFreshAccessToken('a1', repository as never),
    ).rejects.toThrow('503');
    expect(repository.markNeedsReconnect).not.toHaveBeenCalled();
  });
});
