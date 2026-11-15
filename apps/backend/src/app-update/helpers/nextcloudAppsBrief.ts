import {
  nextcloudAppUpdates,
  nextcloudForAccount,
  nextcloudStoreApps,
} from 'src/nextcloud/nextcloud.client';
import { UpdateWithAccount } from '../app-update.types';

/**
 * Para o estudo do próprio Nextcloud: as apps ligadas, lidas agora pela API (sem
 * comandos na máquina), quais não têm versão para o Nextcloud novo na App Store e
 * quais têm atualização própria. Vazio para as outras apps.
 */
export async function nextcloudAppsBrief(
  update: UpdateWithAccount,
): Promise<string> {
  if (update.account?.provider !== 'NEXTCLOUD' || update.component) return '';
  try {
    const client = nextcloudForAccount(update.account);
    if (!(await client.me()).isAdmin) {
      return '\n\nAPPS DENTRO DO NEXTCLOUD: a conta ligada não é administradora, por isso o MyHomeLab não as vê. Diz no estudo que ficaram por ver.';
    }
    const apps = await client.apps();
    const [current, target] = await Promise.all([
      nextcloudStoreApps(update.fromVersion),
      nextcloudStoreApps(update.toVersion),
    ]);
    // Na App Store para a versão de agora mas não para a nova: ficam desligadas no upgrade.
    const unsupported = apps.filter(
      (app) => current.has(app.id) && !target.has(app.id),
    );
    const own = nextcloudAppUpdates(apps, current);
    return (
      `\n\nAPPS DENTRO DO NEXTCLOUD (lidas agora pelo MyHomeLab, pela API): ${apps.length} ligadas — ${apps.map((app) => `${app.name} ${app.version}`).join(', ')}.\n` +
      `- Sem versão na App Store para a ${update.toVersion} (o Nextcloud desliga-as no upgrade): ${unsupported.length ? unsupported.map((app) => app.name).join(', ') : 'nenhuma'}.\n` +
      `- Com versão nova na App Store (cada uma é uma atualização à parte, com o seu estudo; não entram nesta): ${own.length ? own.map((app) => `${app.name} ${app.installed} → ${app.latest}`).join(', ') : 'nenhuma'}.\n` +
      'Põe isto no estudo, numa secção "## Apps instaladas". Não precisas de comandos na máquina para as ver.'
    );
  } catch (error) {
    return `\n\nAPPS DENTRO DO NEXTCLOUD: não consegui lê-las (${error instanceof Error ? error.message : String(error)}). Diz no estudo que ficaram por ver.`;
  }
}
