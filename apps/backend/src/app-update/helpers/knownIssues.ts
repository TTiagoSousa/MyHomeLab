import {
  cleanVersion,
  issuesSince,
  ReleaseNote,
  releaseHistory,
} from 'src/integrations/releases';
import { UpdateWithAccount } from '../app-update.types';
import { repositoryOf } from './releaseSources';

/** As issues abertas no repositório desde que a versão nova saiu, as mais comentadas primeiro. */
export async function knownIssues(update: UpdateWithAccount): Promise<string> {
  if (!update.account) {
    return (
      `O Proxmox VE não tem issues num repositório público que o MyHomeLab leia. Os problemas conhecidos da ${update.toVersion} estão no fórum (https://forum.proxmox.com) e no bugzilla (https://bugzilla.proxmox.com). ` +
      'Se não os conseguires ler, diz no estudo que ficaram por ver, e conta com isso no risco.'
    );
  }
  const repository = repositoryOf(update);
  if (!repository) {
    return update.component
      ? 'Esta peça não diz onde estão as issues.'
      : 'Esta app não diz onde estão as issues.';
  }
  const notes = await releaseHistory(
    repository,
    update.fromVersion,
    update.toVersion,
    0,
  ).catch((): ReleaseNote[] => []);
  const released = notes.find(
    (note) => cleanVersion(note.version) === cleanVersion(update.toVersion),
  )?.publishedAt;
  const since = released
    ? new Date(released)
    : new Date(Date.now() - 14 * 86_400_000);
  // Num repositório com vários add-ons, só as issues deste (pelo nome da pasta).
  const folder = /\/([^/]+)\/CHANGELOG\.md$/.exec(update.repository ?? '');
  const issues = await issuesSince(
    repository,
    since,
    15,
    update.repository?.startsWith('changelog:') && folder
      ? folder[1].replace(/[_-]+/g, ' ')
      : undefined,
  );
  if (!issues.length) {
    return `Sem issues novas em ${repository.repo} desde ${since.toISOString().slice(0, 10)}.`;
  }
  return (
    `Issues abertas em ${repository.repo} desde ${since.toISOString().slice(0, 10)} (a ${update.toVersion} saiu nesse dia), as mais comentadas primeiro:\n` +
    issues
      .map(
        (issue) =>
          `· [${issue.state}, ${issue.comments} comentários] ${issue.title}${issue.labels.length ? ` {${issue.labels.join(', ')}}` : ''} — ${issue.url}`,
      )
      .join('\n')
  );
}
