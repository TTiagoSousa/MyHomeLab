import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { loginUser } from '../helpers/loginUser';
import { validateSession } from '../helpers/validateSession';
import { buildGoogleAuthUrl } from 'src/connected-account/helpers/buildGoogleAuthUrl';
import { Role } from 'src/generated/prisma/client/client';

jest.mock('src/connected-account/google/google-oauth.client', () => ({
  buildGoogleConsentUrl: (state: string) =>
    `https://consent.example/?state=${state}`,
}));

const SECRET = 'segredo-de-teste-com-tamanho-suficiente';
const jwt = new JwtService({
  secret: SECRET,
  signOptions: { expiresIn: '7d' },
});

const sessionUser: {
  id: string;
  username: string;
  role: Role;
  tokenVersion: number;
} = {
  id: 'user-1',
  username: 'ana',
  role: Role.ADMIN,
  tokenVersion: 3,
};

function userRepository(stored: typeof sessionUser | null = sessionUser) {
  return {
    findSessionById: jest.fn().mockResolvedValue(stored),
  } as never;
}

function strategyWith(repository = userRepository()) {
  const config = { get: () => SECRET } as never;
  return new JwtStrategy(config, repository);
}

type Outcome = { ok: true; user: unknown } | { ok: false; reason: unknown };

/** Corre o passport-jwt de ponta a ponta: lê o cookie, verifica a assinatura e a audience, chama o validate. */
function authenticate(strategy: JwtStrategy, token: string): Promise<Outcome> {
  return new Promise((resolve) => {
    const run = Object.create(strategy) as JwtStrategy & {
      success: (user: unknown) => void;
      fail: (reason: unknown) => void;
      error: (reason: unknown) => void;
      authenticate: (req: unknown) => void;
    };
    run.success = (user) => resolve({ ok: true, user });
    run.fail = (reason) => resolve({ ok: false, reason });
    run.error = (reason) => resolve({ ok: false, reason });
    run.authenticate({ cookies: { access_token: token }, headers: {} });
  });
}

describe('JwtStrategy', () => {
  it('aceita a sessão assinada pelo login', async () => {
    const token = loginUser(sessionUser, jwt);
    const outcome = await authenticate(strategyWith(), token);
    expect(outcome).toEqual({
      ok: true,
      user: { id: 'user-1', username: 'ana', role: Role.ADMIN },
    });
  });

  it('recusa o state do OAuth do Google posto no cookie', async () => {
    const url = buildGoogleAuthUrl('user-1', 'gmail', jwt);
    const state = new URL(url).searchParams.get('state')!;
    const repository = userRepository();
    const outcome = await authenticate(strategyWith(repository), state);
    expect(outcome.ok).toBe(false);
    expect(
      (repository as unknown as { findSessionById: jest.Mock }).findSessionById,
    ).not.toHaveBeenCalled();
  });

  it('recusa um token sem audience (as sessões de antes)', async () => {
    const old = jwt.sign({ sub: 'user-1', username: 'ana', role: Role.ADMIN });
    const outcome = await authenticate(strategyWith(), old);
    expect(outcome.ok).toBe(false);
  });

  it('recusa um token de sessão sem sub nem role', async () => {
    const token = jwt.sign({ ver: 3 }, { audience: 'session' });
    const outcome = await authenticate(strategyWith(), token);
    expect(outcome.ok).toBe(false);
  });
});

describe('validateSession', () => {
  const payload = {
    sub: 'user-1',
    username: 'ana',
    role: Role.ADMIN,
    ver: 3,
    aud: 'session',
  };

  it('recusa quando o tokenVersion da base de dados já é outro (saiu)', async () => {
    const repository = userRepository({ ...sessionUser, tokenVersion: 4 });
    await expect(validateSession(payload, repository)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('recusa um utilizador que já não existe', async () => {
    await expect(
      validateSession(payload, userRepository(null)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('usa o role da base de dados e não o do token', async () => {
    const repository = userRepository({ ...sessionUser, role: Role.USER });
    await expect(validateSession(payload, repository)).resolves.toEqual({
      id: 'user-1',
      username: 'ana',
      role: Role.USER,
    });
  });

  it('recusa o payload do state, mesmo que chegue ao validate', async () => {
    const state = {
      userId: 'user-1',
      kind: 'gmail',
      aud: 'google-oauth-state',
    };
    await expect(
      validateSession(state, userRepository()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
