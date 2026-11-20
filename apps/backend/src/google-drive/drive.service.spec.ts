import { DriveService } from './drive.service';
import * as client from './drive.client';

jest.mock('./drive.client', () => ({
  ...jest.requireActual<object>('./drive.client'),
  getDriveFile: jest.fn(),
}));

const parents: Record<string, string[]> = {
  sheet: ['daily'],
  daily: ['company'],
  company: ['root'],
  other: ['root'],
  root: [],
};

describe('DriveService.writableBy', () => {
  const link = {
    id: 'l1',
    fileId: 'company',
    projectId: 'p1',
    project: { id: 'p1', name: 'Empresa X' },
  };
  const prisma = {
    driveLink: { findMany: jest.fn().mockResolvedValue([link]) },
  };
  const service = new DriveService(prisma as never, {} as never);
  const session = {
    account: { id: 'a1', userId: 'u1' },
    token: 't',
  } as never;

  beforeAll(() => {
    (client.getDriveFile as jest.Mock).mockImplementation(
      (_token: string, id: string) =>
        Promise.resolve({ id, name: id, mimeType: 'x', parents: parents[id] }),
    );
  });

  it('allows a file inside a linked folder', async () => {
    expect(await service.writableBy(session, 'sheet')).toEqual([link]);
  });

  it('allows the linked folder itself', async () => {
    expect(await service.writableBy(session, 'company')).toEqual([link]);
  });

  it('refuses a file outside the linked folders', async () => {
    expect(await service.writableBy(session, 'other')).toEqual([]);
    await expect(
      service.assertWritable(session, 'other', 'mudar «other»'),
    ).rejects.toThrow(/não está ligado a nenhum projeto/);
  });
});
