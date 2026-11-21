import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ServerEntry } from '../../../Hooks/Servers/useServers';
import { useServerShell } from '../../../Hooks/Servers/useServerShell';
import { useServerCommands } from '../../../Hooks/Servers/useServerCommands';
import Global_Input from '../../../Components/Inputs/Global_Input/Global_Input';
import { Apps_Section } from './appsShared';
import { dateLocale } from '../../../i18n';
import * as Icon from '../../../Imports/icons';

const HISTORY_SHOWN = 15;

const formatDateTime = (date: string) =>
  new Date(date).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

interface Proxmox_Server_Commands_Props {
  server: ServerEntry;
  onChanged: () => void;
}

const Proxmox_Server_Commands = ({ server, onChanged }: Proxmox_Server_Commands_Props) => {
  const { t } = useTranslation('addons');
  const shell = useServerShell(server.id, onChanged);
  const { commands, fetchCommands } = useServerCommands(server.id);
  const [user, setUser] = useState(server.sshUser ?? 'root');
  const [port, setPort] = useState(String(server.sshPort ?? 22));
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [confirmTrustNewKey, setConfirmTrustNewKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const history = commands.slice(0, HISTORY_SHOWN);
  const setupCommand = server.sshPublicKey
    ? `mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '${server.sshPublicKey}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`
    : '';

  const trustNewKey = async () => {
    await shell.resetHostKey();
    setConfirmTrustNewKey(false);
  };

  const copySetup = async () => {
    await navigator.clipboard.writeText(setupCommand);
    setCopied(true);
  };

  if (!server.sshEnabled) {
    return (
      <Apps_Section icon={<Icon.Server />} title={t('apps.proxmox.commands.title')} description={t('apps.proxmox.commands.offDescription')}>
        <div className='Apps_inline_fields'>
          <div className='Apps_inline_field'>
            <label htmlFor='ssh-user'>{t('apps.proxmox.commands.user')}</label>
            <Global_Input id='ssh-user' value={user} onChange={(e) => setUser(e.target.value)} />
          </div>
          <div className='Apps_inline_field small'>
            <label htmlFor='ssh-port'>{t('apps.proxmox.commands.port')}</label>
            <Global_Input id='ssh-port' value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        <p className='Apps_section_note'>{t('apps.proxmox.commands.safety')}</p>
        <div className='Apps_footer'>
          <button type='button' className='active' onClick={() => void shell.enable(user.trim() || 'root', Number(port) || 22)} disabled={shell.busy}>
            {t('apps.proxmox.commands.enable')}
          </button>
        </div>
      </Apps_Section>
    );
  }

  return (
    <Apps_Section icon={<Icon.Server />} title={t('apps.proxmox.commands.title')} description={t('apps.proxmox.commands.onDescription')}>
      <dl className='Apps_details'>
        <dt>{t('apps.proxmox.commands.access')}</dt>
        <dd>
          {server.sshUser}@{server.host}:{server.sshPort}
        </dd>
        <dt>{t('apps.proxmox.commands.hostKey')}</dt>
        <dd>
          {server.sshHostKey
            ? t('apps.proxmox.commands.hostKeyStored', {
                fingerprint: server.sshHostKey,
                date: server.sshHostKeyAt ? formatDateTime(server.sshHostKeyAt) : '—',
              })
            : t('apps.proxmox.commands.hostKeyPending')}
        </dd>
      </dl>

      {server.sshHostKey && (
        <div className='Apps_setup'>
          <p className='Apps_section_note'>{t('apps.proxmox.commands.hostKeyNote')}</p>
          <div className='Apps_footer'>
            {confirmTrustNewKey ? (
              <>
                <button type='button' onClick={() => setConfirmTrustNewKey(false)}>
                  {t('apps.cancel')}
                </button>
                <button type='button' className='danger' onClick={() => void trustNewKey()} disabled={shell.busy}>
                  {t('apps.proxmox.commands.confirmTrustNewKey')}
                </button>
              </>
            ) : (
              <button type='button' onClick={() => setConfirmTrustNewKey(true)}>
                {t('apps.proxmox.commands.trustNewKey')}
              </button>
            )}
          </div>
        </div>
      )}

      <div className='Apps_setup'>
        <p className='Apps_section_note'>{t('apps.proxmox.commands.setup', { user: server.sshUser })}</p>
        <code className='Apps_code'>{setupCommand}</code>
        <div className='Apps_footer'>
          <button type='button' onClick={() => void copySetup()}>
            {copied ? t('apps.proxmox.commands.copied') : t('apps.proxmox.commands.copy')}
          </button>
          <button type='button' onClick={() => void shell.runTest()} disabled={shell.busy}>
            {shell.busy ? t('apps.proxmox.checking') : t('apps.proxmox.commands.test')}
          </button>
        </div>
        {shell.test && (
          <p className={`Apps_section_note ${shell.test.ok ? 'ok' : 'error'}`}>
            {shell.test.ok ? t('apps.proxmox.commands.testOk', { output: shell.test.output }) : shell.test.output}
          </p>
        )}
      </div>

      <div className='Apps_commands'>
        <span className='Apps_commands_title'>{t('apps.proxmox.commands.history')}</span>
        {history.length === 0 && <p className='Apps_section_note'>{t('apps.proxmox.commands.empty')}</p>}
        {history.map((command) => (
          <details key={command.id} className={`Apps_command ${command.status.toLowerCase()}`}>
            <summary>
              <span className='Apps_chip'>{t(`apps.proxmox.commands.status.${command.status}`)}</span>
              {command.autoApproved && <span className='Apps_chip'>{t('apps.proxmox.commands.readOnly')}</span>}
              {command.snapshotName && <span className='Apps_chip' title={command.snapshotName}>{t('apps.proxmox.commands.snapshot')}</span>}
              <code>{command.command}</code>
              <span className='Apps_command_meta'>{formatDateTime(command.createdAt)}</span>
            </summary>
            {command.reason && <span className='Apps_command_reason'>{command.reason}</span>}
            {command.output && <pre className='Apps_command_output'>{command.output}</pre>}
          </details>
        ))}
      </div>

      <div className='Apps_footer'>
        <button type='button' onClick={() => void fetchCommands()}>
          {t('apps.proxmox.commands.refresh')}
        </button>
        {confirmDisable ? (
          <>
            <button type='button' onClick={() => setConfirmDisable(false)}>
              {t('apps.cancel')}
            </button>
            <button type='button' className='danger' onClick={() => void shell.disable()} disabled={shell.busy}>
              {t('apps.proxmox.commands.confirmDisable')}
            </button>
          </>
        ) : (
          <button type='button' className='danger' onClick={() => setConfirmDisable(true)}>
            {t('apps.proxmox.commands.disable')}
          </button>
        )}
      </div>
    </Apps_Section>
  );
};

export default Proxmox_Server_Commands;
