import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import {
  hostOf,
  nextcloudAppUpdates,
  nextcloudForAccount,
  nextcloudStoreApps,
} from 'src/nextcloud/nextcloud.client';

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const accountLabel = (account: ConnectedAccount) => {
  const url = account.baseUrl ?? account.caldavUrl;
  return `${account.displayName ?? 'Nextcloud'} (${hostOf(url) ?? '?'})`;
};

/**
 * O Nextcloud a usar: o único, ou o que bate com o nome ou o endereço que o
 * agente passou. Devolve uma frase para o agente quando não dá.
 */
export async function nextcloudTarget(
  repository: PrismaConnectedAccountRepository,
  userId: string,
  wanted?: string,
): Promise<ConnectedAccount | string> {
  const accounts = (
    await repository.findAllByUser(userId, ConnectionProvider.NEXTCLOUD)
  ).filter(
    (account) =>
      account.isActive &&
      (account.baseUrl || account.caldavUrl) &&
      account.caldavPassword,
  );
  if (!accounts.length) {
    return 'Não há nenhum Nextcloud ligado. Liga-o em Apps ligadas → Nextcloud.';
  }
  const matches = wanted?.trim()
    ? accounts.filter((account) =>
        normalize(accountLabel(account)).includes(normalize(wanted)),
      )
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual o Nextcloud: ${accounts.map(accountLabel).join(', ')}.`;
  }
  return matches[0];
}

/** A versão, a manutenção, a conta (admin?) e quantas apps têm versão nova. */
export async function overview(account: ConnectedAccount): Promise<string> {
  const client = nextcloudForAccount(account);
  const [status, user] = await Promise.all([client.status(), client.me()]);
  const lines = [
    `${accountLabel(account)}: versão ${status.version}${account.appLatestVersion ? ` (há a ${account.appLatestVersion})` : ''}.`,
    `Manutenção: ${status.maintenance ? 'LIGADA' : 'não'}${status.needsDbUpgrade ? ' · falta atualizar a base de dados (occ upgrade)' : ''}.`,
    `Conta: ${user.id}${user.isAdmin ? ' (administrador)' : user.isAdmin === null ? ' (não consegui ver se é administrador: o pedido dos grupos falhou)' : ' (sem administrador: as apps não se veem)'}.`,
  ];
  if (user.isAdmin) {
    const apps = await client.apps();
    const store = await nextcloudStoreApps(status.version).catch(() => null);
    const updates = store ? nextcloudAppUpdates(apps, store) : [];
    lines.push(
      `Apps ligadas: ${apps.length}; com versão nova na App Store: ${store ? updates.length : '? (a App Store não respondeu)'}.`,
    );
  }
  lines.push(
    'As atualizações do Nextcloud e de cada app estão nas atualizações (update_list). Os comandos (occ) correm na máquina do Nextcloud (CT: pct exec; VM: qm guest exec) com server_run_command.',
  );
  return lines.join('\n');
}

/** As apps ligadas, com a versão instalada e a da App Store (só com admin). */
export async function listApps(
  account: ConnectedAccount,
  input: { only_updates?: boolean },
): Promise<string> {
  const client = nextcloudForAccount(account);
  const [status, user] = await Promise.all([client.status(), client.me()]);
  if (user.isAdmin === false) {
    return 'A conta ligada não é administradora: o Nextcloud não diz as apps. Liga com a password de app de uma conta admin.';
  }
  const { apps, unreadable } = await client.appsRead();
  const store = await nextcloudStoreApps(status.version).catch(() => null);
  const missed = unreadable
    ? ` ${unreadable} app(s) não se conseguiram ler e ficaram de fora.`
    : '';
  // Sem a App Store não se sabe se há versões novas: nunca dizer que não há.
  if (input.only_updates && !store) {
    return `A App Store do Nextcloud não respondeu: não consegui ver se há versões novas das ${apps.length} app(s). Tenta mais tarde.${missed}`;
  }
  const newer = new Map(
    (store ? nextcloudAppUpdates(apps, store) : []).map((update) => [
      update.id,
      update.latest,
    ]),
  );
  const shown = input.only_updates
    ? apps.filter((app) => newer.has(app.id))
    : apps;
  if (!shown.length) {
    return input.only_updates
      ? `Nenhuma app tem versão nova na App Store.${missed}`
      : `Não há apps ligadas.${missed}`;
  }
  return [
    `Nextcloud ${status.version} — ${shown.length} app(s)${store ? '' : ' (a App Store não respondeu: não sei se há versões novas)'}:${missed}`,
    ...shown.map(
      (app) =>
        `- ${app.name} (${app.id}) ${app.version}${newer.has(app.id) ? ` → ${newer.get(app.id)} disponível` : ''}`,
    ),
  ].join('\n');
}
