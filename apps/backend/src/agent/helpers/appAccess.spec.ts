import {
  AppAccessLevel,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import { AccessTarget, appAccessBlock, setsOf } from './appAccess';

const gmail = (
  id: string,
  email: string,
  levels: Record<string, AppAccessLevel>,
): AccessTarget => ({
  type: 'APP',
  id,
  provider: ConnectionProvider.GMAIL,
  names: [email],
  levels,
});

describe('appAccessBlock', () => {
  it('sem nada guardado para o agente, deixa', () => {
    const targets = [
      gmail('a', 'eu@gmail.com', { outro: AppAccessLevel.NONE }),
    ];
    expect(
      appAccessBlock('create_email_rule', {}, 'email', targets),
    ).toBeNull();
  });

  it('ferramentas que não são de uma app nunca são travadas', () => {
    const targets = [
      gmail('a', 'eu@gmail.com', { email: AppAccessLevel.NONE }),
    ];
    expect(appAccessBlock('board_list', {}, 'email', targets)).toBeNull();
  });

  it('READ deixa ler e não deixa mudar', () => {
    const targets = [
      gmail('a', 'eu@gmail.com', { email: AppAccessLevel.READ }),
    ];
    expect(appAccessBlock('search_emails', {}, 'email', targets)).toBeNull();
    expect(appAccessBlock('create_email_rule', {}, 'email', targets)).toMatch(
      /não pode mudar/,
    );
  });

  it('NONE não deixa nem ler', () => {
    const targets = [
      gmail('a', 'eu@gmail.com', { email: AppAccessLevel.NONE }),
    ];
    expect(appAccessBlock('search_emails', {}, 'email', targets)).toMatch(
      /não pode ler/,
    );
  });

  it('com várias contas, vale a que o agente escolheu', () => {
    const targets = [
      gmail('a', 'pessoal@gmail.com', { email: AppAccessLevel.WRITE }),
      gmail('b', 'trabalho@gmail.com', { email: AppAccessLevel.READ }),
    ];
    expect(
      appAccessBlock(
        'create_email_rule',
        { accountEmail: 'pessoal@gmail.com' },
        'email',
        targets,
      ),
    ).toBeNull();
    expect(
      appAccessBlock(
        'create_email_rule',
        { accountEmail: 'Trabalho@gmail.com' },
        'email',
        targets,
      ),
    ).toMatch(/trabalho@gmail.com/);
  });

  it('sem conta escolhida e nenhuma permitida, trava', () => {
    const targets = [
      gmail('a', 'pessoal@gmail.com', { email: AppAccessLevel.READ }),
      gmail('b', 'trabalho@gmail.com', { email: AppAccessLevel.READ }),
    ];
    expect(appAccessBlock('create_email_rule', {}, 'email', targets)).toMatch(
      /nenhuma destas apps/,
    );
  });
});

describe('setsOf', () => {
  it('o Proxmox tem os três conjuntos do servidor', () => {
    expect(setsOf('PROXMOX').sort()).toEqual(
      ['server', 'serverControl', 'serverShell'].sort(),
    );
  });
});
