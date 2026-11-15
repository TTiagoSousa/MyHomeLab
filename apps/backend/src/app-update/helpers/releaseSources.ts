import { VERSION_SOURCES } from 'src/connected-account/helpers/checkAppVersion';
import { cleanVersion, ReleaseRepository } from 'src/integrations/releases';
import { UpdateWithAccount } from '../app-update.types';

/** "https://github.com/dono/repo/releases/…" → "github:dono/repo". */
export const repositoryFromUrl = (url: string | null) => {
  const match = /github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(url ?? '');
  return match ? `github:${match[1]}/${match[2]}` : null;
};

/**
 * Onde estão as notas de um add-on, pela ficha do Supervisor: um repositório
 * próprio ("github:dono/repo", com releases) ou uma pasta de um repositório com
 * vários add-ons ("changelog:<CHANGELOG.md em bruto>").
 */
export const addonSource = (url: string | null | undefined) => {
  const folder =
    /github\.com\/([^/\s]+)\/([^/\s#?]+)\/tree\/([^/\s]+)\/([^\s#?]+)/i.exec(
      url ?? '',
    );
  if (folder) {
    const [, owner, repo, branch, path] = folder;
    return {
      repository: `changelog:https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path.replace(/\/+$/, '')}/CHANGELOG.md`,
      releaseUrl: `https://github.com/${owner}/${repo}/blob/${branch}/${path.replace(/\/+$/, '')}/CHANGELOG.md`,
    };
  }
  const repository = repositoryFromUrl(url ?? null);
  return repository ? { repository, releaseUrl: null } : null;
};

/** O pedaço de um CHANGELOG.md entre a versão instalada (exclusive) e a nova. */
export const changelogBetween = (
  markdown: string,
  from: string,
  to: string,
) => {
  const lines = markdown.split(/\r?\n/);
  const headingOf = (version: string) =>
    lines.findIndex((line) =>
      new RegExp(
        `^#{1,3}\\s*\\[?v?${cleanVersion(version).replace(/\./g, '\\.')}\\b`,
      ).test(line),
    );
  const start = headingOf(to);
  if (start < 0) return markdown.slice(0, 6000);
  const end = headingOf(from);
  return lines
    .slice(start, end > start ? end : start + 80)
    .join('\n')
    .slice(0, 8000);
};

export const parseRepository = (
  value: string | null,
): ReleaseRepository | null => {
  const match = /^(github|codeberg):(.+)$/.exec(value ?? '');
  return match
    ? { host: match[1] as ReleaseRepository['host'], repo: match[2] }
    : null;
};

/** Onde estão as releases e as issues: as da app, ou as do repositório da peça. */
export function repositoryOf(
  update: UpdateWithAccount,
): ReleaseRepository | null {
  if (!update.component) {
    return update.account
      ? (VERSION_SOURCES[update.account.provider]?.repository ?? null)
      : null;
  }
  const changelog =
    /^changelog:https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\//.exec(
      update.repository ?? '',
    );
  return changelog
    ? { host: 'github', repo: `${changelog[1]}/${changelog[2]}` }
    : parseRepository(update.repository);
}
