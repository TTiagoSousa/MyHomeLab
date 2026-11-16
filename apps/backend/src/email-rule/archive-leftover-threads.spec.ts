import { onlyYoursLeft } from './helpers/archiveLeftoverThreads';

describe('onlyYoursLeft', () => {
  const archived = new Set(['original']);

  it('arquiva a conversa quando só restam mensagens tuas', () => {
    expect(
      onlyYoursLeft(
        [
          { id: 'original', labelIds: ['INBOX'] },
          { id: 'reencaminhado', labelIds: ['SENT', 'INBOX'] },
        ],
        archived,
      ),
    ).toBe(true);
  });

  it('deixa a conversa quando alguém respondeu', () => {
    expect(
      onlyYoursLeft(
        [
          { id: 'original', labelIds: ['INBOX'] },
          { id: 'minha', labelIds: ['SENT', 'INBOX'] },
          { id: 'resposta', labelIds: ['INBOX', 'UNREAD'] },
        ],
        archived,
      ),
    ).toBe(false);
  });

  it('não mexe numa conversa que já saiu da caixa de entrada', () => {
    expect(
      onlyYoursLeft(
        [
          { id: 'original', labelIds: ['INBOX'] },
          { id: 'minha', labelIds: ['SENT'] },
        ],
        archived,
      ),
    ).toBe(false);
  });
});
