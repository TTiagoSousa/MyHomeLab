import { unattendedBlock, unattendedCommandAllowed } from './unattendedTools';

describe('o que um disparo pode alterar', () => {
  it('no chat não há limite', () => {
    expect(unattendedBlock('pve_guest_power', {}, 'chat', true)).toBeNull();
    expect(unattendedBlock('create_agent', {}, 'chat', true)).toBeNull();
  });

  it('as leituras passam sempre', () => {
    expect(unattendedBlock('list_servers', {}, 'schedule', false)).toBeNull();
  });

  it('um disparo comenta e pergunta, mas não reinicia máquinas', () => {
    expect(unattendedBlock('board_comment', {}, 'schedule', true)).toBeNull();
    expect(unattendedBlock('pve_guest_power', {}, 'schedule', true)).toMatch(
      /Recusado/,
    );
    expect(
      unattendedBlock('tplink_router_port_forward', {}, 'schedule', true),
    ).toMatch(/Recusado/);
  });

  it('nunca envia emails nem muda a equipa sem ele, nem numa instalação', () => {
    for (const source of ['schedule', 'study', 'install', 'verify']) {
      expect(unattendedBlock('send_email_draft', {}, source, true)).toMatch(
        /Recusado/,
      );
      expect(unattendedBlock('update_agent', {}, source, true)).toMatch(
        /Recusado/,
      );
    }
  });

  it('só o estudo grava o estudo', () => {
    expect(unattendedBlock('update_save_study', {}, 'study', true)).toBeNull();
    expect(unattendedBlock('update_save_study', {}, 'schedule', true)).toMatch(
      /Recusado/,
    );
  });

  it('uma instalação aprovada corre o que precisa', () => {
    expect(unattendedBlock('update_run', {}, 'install', true)).toBeNull();
    expect(
      unattendedBlock(
        'server_run_command',
        { command: 'apt upgrade -y' },
        'install',
        true,
      ),
    ).toBeNull();
  });

  it('num disparo, só leituras e reiniciar um serviço', () => {
    expect(unattendedCommandAllowed('systemctl status nginx')).toBe(true);
    expect(
      unattendedCommandAllowed('pct exec 210 -- systemctl restart adguardhome'),
    ).toBe(true);
    expect(unattendedCommandAllowed('systemctl restart nginx; rm -rf /')).toBe(
      false,
    );
    expect(unattendedCommandAllowed('reboot')).toBe(false);
    expect(
      unattendedBlock(
        'server_run_command',
        { command: 'pct stop 210' },
        'schedule',
        true,
      ),
    ).toMatch(/Recusado/);
  });
});
