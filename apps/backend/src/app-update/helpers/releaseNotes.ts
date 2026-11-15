import {
  cleanVersion,
  compareVersions,
  releaseHistory,
} from 'src/integrations/releases';
import { createProxmoxClient } from 'src/proxmox/proxmox.client';
import { toProxmoxConnection } from 'src/server-connection/server-connection.service';
import { PVE_ROADMAP_URL } from '../app-update.constants';
import { UpdateWithAccount } from '../app-update.types';
import { changelogBetween, repositoryOf } from './releaseSources';
import { expandLinkedNotes } from './linkedNotes';
import { nextcloudStoreApps } from 'src/nextcloud/nextcloud.client';

/** Quanto texto de notas cabe: numa versão .0, numa de correção e no total. */
const MAJOR_NOTES = 15_000;
const PATCH_NOTES = 3_000;
const TOTAL_NOTES = 70_000;
/** O changelog do pve-manager num salto de muitas versões de correção (ex.: 9.2.2 → 9.2.26). */
const HOST_NOTES = 40_000;
const isMajor = (version: string) => /\.0(\.0)?$/.test(version);
import { updateLabel } from './updateFields';

/** O changelog Debian até à versão instalada (exclusive): "pve-manager (9.2.3) trixie; …". */
export const debianChangelogSince = (text: string, from: string) => {
  const lines = text.split(/\r?\n/);
  const end = lines.findIndex((line) =>
    new RegExp(
      `^\\S+ \\(${cleanVersion(from).replace(/\./g, '\\.')}[)~+-]`,
    ).test(line),
  );
  return lines
    .slice(0, end >= 0 ? end : 120)
    .join('\n')
    .slice(0, HOST_NOTES);
};

/** No host: o changelog do pve-manager, lido ao próprio Proxmox (o mesmo que o `apt changelog`). */
async function hostReleaseNotes(update: UpdateWithAccount): Promise<string> {
  if (!update.hostServer) return 'O servidor desta atualização já não existe.';
  const client = createProxmoxClient(toProxmoxConnection(update.hostServer));
  try {
    const [node] = await client.listNodes();
    if (update.hostPackages !== null) {
      const packages = await client.aptUpdates(node.node);
      return (
        `${packages.length} pacotes do sistema por atualizar no nó ${node.node} (sem versão nova do Proxmox VE; está na ${update.toVersion}), de → para:\n` +
        packages
          .map(
            (item) =>
              `- ${item.Package} ${item.OldVersion ?? '?'} → ${item.Version}${item.Origin ? ` (${item.Origin})` : ''}`,
          )
          .join('\n')
      );
    }
    const changelog = await client.aptChangelog(node.node, 'pve-manager');
    // Sem versão nova por instalar, o apt responde com o erro em texto ("E: …").
    if (/^E: /m.test(changelog))
      throw new Error(changelog.trim().split('\n')[0]);
    return (
      `Changelog do pve-manager (Proxmox VE) entre a ${update.fromVersion} e a ${update.toVersion}, lido ao nó ${node.node}. ` +
      `As novidades de cada versão estão também em ${PVE_ROADMAP_URL}.\n\n` +
      debianChangelogSince(changelog, update.fromVersion)
    );
  } catch (error) {
    return `Não consegui ler o changelog do pve-manager ao Proxmox (${error instanceof Error ? error.message : String(error)}). As novidades de cada versão estão em ${PVE_ROADMAP_URL}.`;
  }
}

/** Uma app dentro do Nextcloud: o changelog de cada versão pelo meio, da App Store (as releases não estão no repositório da app). */
async function nextcloudAppNotes(update: UpdateWithAccount): Promise<string> {
  const server = update.account?.appVersion;
  if (!server)
    return 'Não sei a versão do Nextcloud, por isso não li a App Store.';
  try {
    const app = (await nextcloudStoreApps(server)).get(update.component ?? '');
    if (!app)
      return `A app ${update.component} não está na App Store para o Nextcloud ${server}.`;
    const between = app.releases.filter(
      (release) =>
        compareVersions(release.version, update.fromVersion) > 0 &&
        compareVersions(release.version, update.toVersion) <= 0,
    );
    if (!between.length)
      return `A App Store não tem versões entre a ${update.fromVersion} e a ${update.toVersion} de ${app.name}.`;
    let text = '';
    for (const release of between) {
      const block = `## ${release.version}${release.created ? ` (${release.created.slice(0, 10)})` : ''}\n${release.changelog || '(sem changelog)'}\n\n`;
      if (text.length + block.length > TOTAL_NOTES) break;
      text += block;
    }
    return `Changelog de ${updateLabel(update)} entre a ${update.fromVersion} e a ${update.toVersion}, da App Store do Nextcloud (${update.releaseUrl ?? `https://apps.nextcloud.com/apps/${update.component}`}):\n\n${text.trim()}`;
  } catch (error) {
    return `Não consegui ler a App Store do Nextcloud (${error instanceof Error ? error.message : String(error)}).`;
  }
}

/** As notas entre a versão instalada e a nova: o CHANGELOG.md da peça, as releases do repositório ou, no host, o changelog do Proxmox. */
export async function releaseNotes(update: UpdateWithAccount): Promise<string> {
  if (!update.account) return hostReleaseNotes(update);
  if (update.component && update.account.provider === 'NEXTCLOUD')
    return nextcloudAppNotes(update);
  if (update.repository?.startsWith('changelog:')) {
    const url = update.repository.slice('changelog:'.length);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!response?.ok) {
      return `Não consegui ler o changelog (${url}).`;
    }
    return (
      `Changelog de ${updateLabel(update)} entre a ${update.fromVersion} e a ${update.toVersion} (${update.releaseUrl ?? url}):\n\n` +
      changelogBetween(
        await response.text(),
        update.fromVersion,
        update.toVersion,
      )
    );
  }
  const repository = repositoryOf(update);
  if (!repository) {
    return update.component
      ? `Esta peça não diz onde estão as releases${update.releaseUrl ? ` (as notas estão em ${update.releaseUrl})` : ''}.${update.account?.provider === 'HOME_ASSISTANT' ? ' Vê o resumo em ha_list_updates.' : ''}`
      : 'Esta app não diz onde estão as releases.';
  }
  const notes = await releaseHistory(
    repository,
    update.fromVersion,
    update.toVersion,
  );
  if (!notes.length) {
    return `Não encontrei releases entre a ${update.fromVersion} e a ${update.toVersion} em ${repository.repo}.`;
  }
  const bodies = await Promise.all(
    notes.map((note) =>
      expandLinkedNotes(
        note.body,
        isMajor(note.version) ? MAJOR_NOTES : PATCH_NOTES,
      ),
    ),
  );
  // Se não cabe tudo, primeiro a versão nova e as .0, depois as outras da mais recente para trás.
  const order = notes
    .map((_, index) => index)
    .sort(
      (a, b) =>
        Number(b === notes.length - 1) - Number(a === notes.length - 1) ||
        Number(isMajor(notes[b].version)) - Number(isMajor(notes[a].version)) ||
        b - a,
    );
  const shown = new Set<number>();
  let room = TOTAL_NOTES;
  for (const index of order) {
    if (bodies[index].length > room) continue;
    room -= bodies[index].length;
    shown.add(index);
  }
  return (
    `${notes.length} release(s) de ${repository.repo} entre a ${update.fromVersion} e a ${update.toVersion}:\n\n` +
    notes
      .map(
        (note, index) =>
          `══ ${note.version}${note.publishedAt ? ` (${note.publishedAt.slice(0, 10)})` : ''} — ${note.url}\n${shown.has(index) ? bodies[index] || '(sem notas)' : '(notas longas demais para caberem aqui: abre o link)'}`,
      )
      .join('\n\n')
  );
}
