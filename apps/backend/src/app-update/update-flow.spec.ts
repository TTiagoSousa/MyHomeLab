import { AppUpdate, AppUpdateStatus } from 'src/generated/prisma/client/client';
import { estimateCost } from 'src/ai-credential/ai-usage.service';
import { FROM_BOARD } from './app-update.constants';
import { isAvailable } from './helpers/updateFields';
import { newerVersion } from './helpers/newerVersion';
import { boardMoveAllowed } from './helpers/boardMoveAllowed';

const update = (status: AppUpdateStatus) =>
  ({ id: 'up1', userId: 'u1', status }) as AppUpdate;

describe('disponíveis (vistas, ainda ninguém as abriu)', () => {
  it('uma nova sem tarefa está disponível; com tarefa (em Todo) já não', () => {
    expect(
      isAvailable({ status: AppUpdateStatus.NEW, boardTaskId: null }),
    ).toBe(true);
    expect(
      isAvailable({ status: AppUpdateStatus.NEW, boardTaskId: 't1' }),
    ).toBe(false);
    expect(
      isAvailable({ status: AppUpdateStatus.STUDY, boardTaskId: null }),
    ).toBe(false);
  });

  it('uma versão mais nova de uma disponível fica disponível e volta a ser anunciada', () => {
    const newer = newerVersion(
      { ...update(AppUpdateStatus.NEW), boardTaskId: null },
      '2.0.0',
    );
    expect(newer.data).toEqual({ announcedAt: null });
  });

  it('uma versão mais nova de uma já aberta volta ao estudo', () => {
    const newer = newerVersion(
      { ...update(AppUpdateStatus.WAITING), boardTaskId: 't1' },
      '2.0.0',
    );
    expect(newer.data).toMatchObject({
      status: AppUpdateStatus.STUDY,
      studiedAt: null,
    });
  });
});

describe('colunas do quadro → estado da atualização', () => {
  it('o utilizador pode pôr nas colunas que não são do agente, e em Done ou Verifying', () => {
    expect(FROM_BOARD).toEqual({
      new: AppUpdateStatus.NEW,
      study: AppUpdateStatus.STUDY,
      ready: AppUpdateStatus.READY,
      waiting: AppUpdateStatus.WAITING,
      later: AppUpdateStatus.LATER,
      cancelled: AppUpdateStatus.CANCELLED,
      verifying: AppUpdateStatus.VERIFYING,
      done: AppUpdateStatus.DONE,
    });
  });

  const at = (
    status: AppUpdateStatus,
    verified = false,
  ): Pick<AppUpdate, 'status' | 'verifyStartedAt' | 'installStartedAt'> => ({
    status,
    verifyStartedAt: verified ? new Date() : null,
    installStartedAt: null,
  });

  it('a correr ou feita não se mexe', () => {
    expect(
      boardMoveAllowed(
        at(AppUpdateStatus.IN_PROGRESS),
        AppUpdateStatus.CANCELLED,
      ),
    ).toBe(false);
    expect(
      boardMoveAllowed(at(AppUpdateStatus.DONE), AppUpdateStatus.READY),
    ).toBe(false);
  });

  it('em Verifying só fecha ou espera por ele (não volta a instalar)', () => {
    expect(
      boardMoveAllowed(at(AppUpdateStatus.VERIFYING), AppUpdateStatus.READY),
    ).toBe(false);
    expect(
      boardMoveAllowed(at(AppUpdateStatus.VERIFYING), AppUpdateStatus.DONE),
    ).toBe(true);
    expect(
      boardMoveAllowed(
        at(AppUpdateStatus.VERIFYING),
        AppUpdateStatus.CANCELLED,
      ),
    ).toBe(true);
  });

  it('só volta a Verifying uma que já foi verificada', () => {
    expect(
      boardMoveAllowed(
        at(AppUpdateStatus.WAITING, true),
        AppUpdateStatus.VERIFYING,
      ),
    ).toBe(true);
    expect(
      boardMoveAllowed(at(AppUpdateStatus.WAITING), AppUpdateStatus.VERIFYING),
    ).toBe(false);
    expect(
      boardMoveAllowed(at(AppUpdateStatus.READY), AppUpdateStatus.VERIFYING),
    ).toBe(false);
  });
});

describe('estimateCost', () => {
  const row = {
    tokensIn: 1_000_000,
    tokensOut: 1_000_000,
    cacheRead: 0,
    cacheWrite: 0,
  };

  it('cada família de modelos tem o seu preço', () => {
    expect(estimateCost('claude-opus-5-5', row)).toBeCloseTo(24 * 0.92);
    expect(estimateCost('claude-opus-5', row)).toBeCloseTo(30 * 0.92);
    expect(estimateCost('claude-haiku-5-5', row)).toBeCloseTo(6 * 0.92);
    expect(estimateCost('claude-sonnet-5-5', row)).toBeCloseTo(18 * 0.92);
  });

  it('a cache lida custa um décimo da entrada', () => {
    const cached = estimateCost('claude-sonnet-5-5', {
      tokensIn: 0,
      tokensOut: 0,
      cacheRead: 1_000_000,
      cacheWrite: 0,
    });
    expect(cached).toBeCloseTo(0.3 * 0.92);
  });
});
