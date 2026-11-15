import { VERSION_SOURCES } from 'src/connected-account/helpers/checkAppVersion';
import { cleanVersion, compareVersions } from 'src/integrations/releases';
import { createProxmoxClient } from 'src/proxmox/proxmox.client';
import { toProxmoxConnection } from 'src/server-connection/server-connection.service';
import { nextcloudForAccount } from 'src/nextcloud/nextcloud.client';
import { VERIFY_TIMEOUT_MS } from '../app-update.constants';
import { UpdateWithAccount } from '../app-update.types';
import { sleep } from './updateDates';

/** A versão que a app (ou a app dentro do Nextcloud, ou o Proxmox VE no host) diz ter agora (null se não responder). */
export async function installedVersion(
  update: UpdateWithAccount,
): Promise<string | null> {
  try {
    if (!update.account) {
      if (!update.hostServer) return null;
      const { version } = await createProxmoxClient(
        toProxmoxConnection(update.hostServer),
      ).version();
      return cleanVersion(version) || null;
    }
    if (update.component && update.account.provider === 'NEXTCLOUD') {
      return await nextcloudForAccount(update.account).appVersion(
        update.component,
      );
    }
    const source = VERSION_SOURCES[update.account.provider];
    if (!source) return null;
    return cleanVersion(await source.installed(update.account)) || null;
  } catch {
    return null;
  }
}

/** Espera pela versão nova (ou, com `anyVersion`, só que a app volte a responder). */
export async function waitForVersion(
  update: UpdateWithAccount,
  timeoutMs = VERIFY_TIMEOUT_MS,
  anyVersion = false,
): Promise<string | null> {
  const started = Date.now();
  let last: string | null = null;
  while (Date.now() - started < timeoutMs) {
    last = await installedVersion(update);
    if (last && (anyVersion || compareVersions(last, update.toVersion) >= 0)) {
      return last;
    }
    await sleep(15_000);
  }
  return last;
}
