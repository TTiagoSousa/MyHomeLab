import {
  ConnectedAccount,
  ConnectionProvider,
} from 'src/generated/prisma/client/client';
import { PrismaConnectedAccountRepository } from 'src/connected-account/repositories/prisma/prisma-connected-account-repository';
import {
  ForgejoClient,
  ForgejoIssue,
  createForgejoClient,
} from 'src/forgejo/forgejo.client';

const day = (date: string) => date.slice(0, 10);

const normalize = (text: string) => text.trim().toLowerCase();

const accountLabel = (account: ConnectedAccount) =>
  `${account.displayName ?? account.username ?? 'Forgejo'} (${account.baseUrl ? new URL(account.baseUrl).host : '?'})`;

export interface ForgejoTarget {
  account: ConnectedAccount;
  client: ForgejoClient;
}

/**
 * A conta Forgejo a usar: a única, ou a que bate com o nome, o utilizador ou o
 * endereço que o agente passou. Devolve uma frase para o agente quando não dá.
 */
export async function forgejoTarget(
  repository: PrismaConnectedAccountRepository,
  userId: string,
  wanted?: string,
): Promise<ForgejoTarget | string> {
  const accounts = (
    await repository.findAllByUser(userId, ConnectionProvider.FORGEJO)
  ).filter(
    (account) => account.isActive && account.accessToken && account.baseUrl,
  );
  if (!accounts.length) {
    return 'Não há nenhuma conta Forgejo ligada. Liga-a em Apps ligadas → Forgejo.';
  }
  const matches = wanted?.trim()
    ? accounts.filter((account) =>
        normalize(accountLabel(account)).includes(normalize(wanted)),
      )
    : accounts;
  if (matches.length !== 1) {
    return `Diz qual a conta Forgejo: ${accounts.map(accountLabel).join(', ')}.`;
  }
  const account = matches[0];
  return {
    account,
    client: createForgejoClient({
      baseUrl: account.baseUrl!,
      token: account.accessToken!,
    }),
  };
}

/** "MyHomeLab" passa a "utilizador/MyHomeLab", com o dono do token. */
export const fullRepo = (target: ForgejoTarget, repo: string) =>
  repo.includes('/')
    ? repo.trim()
    : `${target.account.username}/${repo.trim()}`;

export async function listRepos(target: ForgejoTarget): Promise<string> {
  const repos = await target.client.repos();
  if (!repos.length) return 'Não há repositórios.';
  return repos
    .map(
      (repo) =>
        `${repo.full_name}${repo.private ? ' (privado)' : ''}${repo.archived ? ' (arquivado)' : ''}: ` +
        `${repo.open_issues_count} issues e ${repo.open_pr_counter} PRs abertos, ` +
        `ramo ${repo.default_branch}, atualizado a ${day(repo.updated_at)}` +
        (repo.description ? ` — ${repo.description}` : ''),
    )
    .join('\n');
}

const issueLine = (issue: ForgejoIssue) =>
  `#${issue.number} [${issue.state === 'open' ? 'aberta' : 'fechada'}] ${issue.title}` +
  ` — de ${issue.user.login}, ${issue.comments} comentários, atualizada a ${day(issue.updated_at)}` +
  (issue.labels.length
    ? `, etiquetas: ${issue.labels.map((label) => label.name).join(', ')}`
    : '');

export async function listIssues(
  target: ForgejoTarget,
  input: {
    repo: string;
    state?: 'open' | 'closed' | 'all';
    pull_requests?: boolean;
    limit?: number;
  },
): Promise<string> {
  const issues = await target.client.issues(fullRepo(target, input.repo), {
    state: input.state ?? 'open',
    type: input.pull_requests ? 'pulls' : 'issues',
    limit: Math.min(Math.max(input.limit ?? 20, 1), 50),
  });
  const what = input.pull_requests ? 'pull requests' : 'issues';
  return issues.length
    ? issues.map(issueLine).join('\n')
    : `Não há ${what} ${input.state === 'closed' ? 'fechadas' : input.state === 'all' ? '' : 'abertas'} em ${fullRepo(target, input.repo)}.`;
}

export async function getIssue(
  target: ForgejoTarget,
  input: { repo: string; number: number },
): Promise<string> {
  const repo = fullRepo(target, input.repo);
  const [issue, comments] = await Promise.all([
    target.client.issue(repo, input.number),
    target.client.comments(repo, input.number),
  ]);
  return [
    issueLine(issue),
    issue.body?.trim()
      ? `\n${issue.body.trim().slice(0, 4000)}`
      : '\n(sem descrição)',
    ...comments
      .slice(-15)
      .map(
        (comment) =>
          `\n${comment.user.login}, ${day(comment.created_at)}: ${comment.body.trim().slice(0, 1500)}`,
      ),
    `\n${issue.html_url}`,
  ].join('');
}

export async function createIssue(
  target: ForgejoTarget,
  input: { repo: string; title: string; body?: string },
): Promise<string> {
  const issue = await target.client.createIssue(fullRepo(target, input.repo), {
    title: input.title,
    body: input.body,
  });
  return `Criada a issue #${issue.number} "${issue.title}": ${issue.html_url}`;
}

export async function commentIssue(
  target: ForgejoTarget,
  input: { repo: string; number: number; body: string },
): Promise<string> {
  await target.client.comment(
    fullRepo(target, input.repo),
    input.number,
    input.body,
  );
  return `Comentário adicionado à #${input.number}.`;
}

export async function setIssueState(
  target: ForgejoTarget,
  input: { repo: string; number: number; state: 'open' | 'closed' },
): Promise<string> {
  const issue = await target.client.setIssueState(
    fullRepo(target, input.repo),
    input.number,
    input.state,
  );
  return `A #${issue.number} "${issue.title}" está agora ${issue.state === 'open' ? 'aberta' : 'fechada'}.`;
}

export async function listReleases(
  target: ForgejoTarget,
  input: { repo: string; limit?: number },
): Promise<string> {
  const releases = await target.client.releases(
    fullRepo(target, input.repo),
    Math.min(input.limit ?? 5, 20),
  );
  if (!releases.length) return 'Ainda não há releases.';
  return releases
    .map(
      (release) =>
        `${release.tag_name}${release.name && release.name !== release.tag_name ? ` (${release.name})` : ''}` +
        `${release.draft ? ' [rascunho]' : ''}${release.prerelease ? ' [pré-release]' : ''}, ${day(release.published_at)}` +
        (release.assets.length
          ? `, ficheiros: ${release.assets.map((asset) => asset.name).join(', ')}`
          : '') +
        (release.body?.trim()
          ? `\n  ${release.body.trim().slice(0, 600).replace(/\n/g, '\n  ')}`
          : ''),
    )
    .join('\n');
}

export async function listCommits(
  target: ForgejoTarget,
  input: { repo: string; branch?: string; limit?: number },
): Promise<string> {
  const commits = await target.client.commits(
    fullRepo(target, input.repo),
    input.branch,
    Math.min(Math.max(input.limit ?? 10, 1), 30),
  );
  if (!commits.length) return 'Não há commits.';
  return commits
    .map(
      (commit) =>
        `${commit.sha.slice(0, 7)} ${day(commit.commit.author.date)} ${commit.commit.author.name}: ${commit.commit.message.split('\n')[0]}`,
    )
    .join('\n');
}

export async function listActionRuns(
  target: ForgejoTarget,
  input: { repo: string; limit?: number },
): Promise<string> {
  const { workflow_runs: runs } = await target.client.actionTasks(
    fullRepo(target, input.repo),
    Math.min(input.limit ?? 10, 30),
  );
  if (!runs?.length)
    return 'Não há execuções do Forgejo Actions neste repositório.';
  return runs
    .map(
      (run) =>
        `#${run.run_number} ${run.name} — ${run.status}, ${run.event} em ${run.head_branch}, ${run.created_at.replace('T', ' ').slice(0, 16)}` +
        (run.display_title ? ` — ${run.display_title}` : ''),
    )
    .join('\n');
}
