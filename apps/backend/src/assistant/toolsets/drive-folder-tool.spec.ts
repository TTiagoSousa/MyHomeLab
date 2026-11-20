import { buildDriveTools } from './drive-tools';
import { AgentContext } from '../agents/agent-context';
import {
  FOLDER,
  createDriveFile,
  getDriveFile,
  searchDrive,
} from 'src/google-drive/drive.client';

jest.mock('src/google-drive/drive.client', () => ({
  ...jest.requireActual<object>('src/google-drive/drive.client'),
  getDriveFile: jest.fn(),
  searchDrive: jest.fn(),
  createDriveFile: jest.fn(),
}));

const PARENT_ID = 'parentFolderId1234567890ab';

describe('drive_create_folder', () => {
  const session = { account: { id: 'acc', userId: 'u1' }, token: 't' };
  const linkCreated = jest.fn();
  const context = {
    userId: 'u1',
    drive: { session: jest.fn().mockResolvedValue(session), linkCreated },
    board: {
      projects: jest
        .fn()
        .mockResolvedValue([
          { id: 'p1', name: 'Chamadas Empresa', identifier: 'CN' },
        ]),
    },
  } as unknown as AgentContext;
  const tool = buildDriveTools(context).find(
    (item) => item.name === 'drive_create_folder',
  )!;
  const run = (input: object) =>
    (tool.handler as (input: object) => Promise<string>)(input);

  beforeEach(() => {
    jest.clearAllMocks();
    (getDriveFile as jest.Mock).mockResolvedValue({
      id: PARENT_ID,
      name: 'Trabalho',
      mimeType: FOLDER,
    });
    (searchDrive as jest.Mock).mockResolvedValue([]);
    (createDriveFile as jest.Mock).mockImplementation(
      (_token: string, metadata: { name: string }) =>
        Promise.resolve({
          id: 'newFolder',
          name: metadata.name,
          mimeType: FOLDER,
        }),
    );
  });

  it('creates a folder at the root without linking it', async () => {
    const result = await run({ name: 'Trabalho' });
    expect(searchDrive).toHaveBeenCalledWith('t', {
      folderId: 'root',
      mimeType: FOLDER,
      limit: 100,
    });
    expect(createDriveFile).toHaveBeenCalledWith('t', {
      name: 'Trabalho',
      mimeType: FOLDER,
      parents: undefined,
    });
    expect(linkCreated).not.toHaveBeenCalled();
    expect(result).toContain('na raiz do Drive');
  });

  it('creates it inside a folder and links it to the project', async () => {
    const result = await run({
      name: 'Empresa',
      parent: PARENT_ID,
      project: 'chamadas empresa',
    });
    expect(createDriveFile).toHaveBeenCalledWith('t', {
      name: 'Empresa',
      mimeType: FOLDER,
      parents: [PARENT_ID],
    });
    expect(linkCreated).toHaveBeenCalledWith(
      session,
      expect.objectContaining({ id: 'newFolder' }),
      ['p1'],
    );
    expect(result).toContain('ligada ao projeto Chamadas Empresa');
  });

  it('reuses a folder with the same name instead of creating another', async () => {
    (searchDrive as jest.Mock).mockResolvedValue([
      { id: 'old', name: 'trabalho', mimeType: FOLDER },
    ]);
    const result = await run({ name: 'Trabalho' });
    expect(createDriveFile).not.toHaveBeenCalled();
    expect(result).toContain('não criei outra');
  });

  it('refuses an unknown project before touching the Drive', async () => {
    const result = await run({ name: 'X', project: 'Nada' });
    expect(createDriveFile).not.toHaveBeenCalled();
    expect(result).toContain('Não há o projeto');
  });
});
