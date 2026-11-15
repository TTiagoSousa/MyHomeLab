import { NotificationKind } from 'src/generated/prisma/client/client';
import { foldUpdateNotices, waitingUpdateId } from './foldUpdateNotices';

const notice = (
  id: string,
  kind: NotificationKind,
  fields: {
    subject?: string;
    connectedAccountId?: string;
    serverConnectionId?: string;
  } = {},
) => ({
  id,
  kind,
  subject: fields.subject ?? null,
  connectedAccountId: fields.connectedAccountId ?? null,
  serverConnectionId: fields.serverConnectionId ?? null,
});

describe('juntar os avisos de uma atualização', () => {
  it('lê a atualização do assunto da pergunta', () => {
    expect(waitingUpdateId('update-waiting:up1:task9')).toBe('up1');
    expect(waitingUpdateId('update-waiting:up1:')).toBe('up1');
    expect(waitingUpdateId('schedule:x')).toBeNull();
    expect(waitingUpdateId(null)).toBeNull();
  });

  it('a pergunta leva o "tem atualização" da mesma app', () => {
    const active = [
      notice('q', NotificationKind.AGENT_NOTICE, {
        subject: 'update-waiting:up1:t1',
      }),
      notice('n', NotificationKind.APP_UPDATE, { connectedAccountId: 'a1' }),
      notice('other', NotificationKind.APP_UPDATE, {
        connectedAccountId: 'a2',
      }),
    ];
    const folded = foldUpdateNotices(active, [
      { id: 'up1', accountId: 'a1', hostServerId: null },
    ]);
    expect(folded.map((item) => item.id)).toEqual(['q', 'other']);
    expect(folded[0].related.map((item) => item.id)).toEqual(['n']);
  });

  it('no Proxmox, junta pelo servidor', () => {
    const folded = foldUpdateNotices(
      [
        notice('q', NotificationKind.AGENT_NOTICE, {
          subject: 'update-waiting:up2:',
        }),
        notice('n', NotificationKind.APP_UPDATE, { serverConnectionId: 's1' }),
      ],
      [{ id: 'up2', accountId: null, hostServerId: 's1' }],
    );
    expect(folded).toHaveLength(1);
    expect(folded[0].related).toHaveLength(1);
  });

  it('sem pergunta, fica tudo como está', () => {
    const active = [
      notice('n', NotificationKind.APP_UPDATE, { connectedAccountId: 'a1' }),
    ];
    expect(foldUpdateNotices(active, [])).toEqual([
      { ...active[0], related: [] },
    ]);
  });
});
