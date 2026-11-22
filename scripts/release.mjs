#!/usr/bin/env node
// Prepares and tags a release from the Conventional Commits since the last tag. No
// dependencies. The flow (docs/development/09-releases.md):
//
//   on develop:  npm run release -- --prepare
//                  computes the next version, bumps every package.json, adds it to
//                  CHANGELOG.md and writes releases/vX.Y.Z/en.md ("vX.Y.Z — title" and
//                  then ### Features / ### Fixes / ### Improvements)
//                write releases/vX.Y.Z/pt-PT.md and es.md by hand, commit
//                "chore(release): vX.Y.Z", push, wait for the CI, fast-forward
//                staging and main
//   on main:     npm run release -- --push
//                  annotated tag vX.Y.Z with en.md as the message, pushed to origin; the
//                  Release workflow creates the GitHub Release, and the Android APK is
//                  built and attached to it (scripts/android-release.mjs)
//
// Options:
//   --dry-run                 show the version and the notes, change nothing
//   --version X.Y.Z           force a version (with or without the "v")
//   --title "Headline"        the title on the first line of the notes
//   --notes notes.md          use a hand-written English file instead of the commits
//   --allow-branch <branch>   run on another branch than develop (--prepare) or main (--push)
//
// The bump follows the commits: "!" or BREAKING CHANGE → major, feat → minor, anything
// else → patch. The first release is v1.0.0.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
};

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
// Like git(), but a failure is an empty answer and git's stderr stays quiet
// ("No names found" before the first release).
const tryGit = (...a) => {
  try {
    return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const VERSION = /^v(\d+)\.(\d+)\.(\d+)$/;
const PACKAGES = [
  'package.json',
  'apps/backend/package.json',
  'apps/frontend/package.json',
  'packages/shared/package.json',
  'apps/mobile/package.json',
];
const LANGUAGES = ['en', 'pt-PT', 'es'];

const prepare = flag('prepare');
const push = flag('push');
const dryRun = flag('dry-run');
if (prepare === push && !dryRun) fail('Use --prepare (on develop) or --push (on main), or --dry-run to preview.');

// --- checks -----------------------------------------------------------------------------

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
const expected = option('allow-branch') ?? (push ? 'main' : 'develop');
if (branch !== expected) {
  fail(`${push ? '--push runs on main' : '--prepare runs on develop'} (you are on ${branch}). Use --allow-branch ${branch} to override.`);
}
if (!dryRun && git('status', '--porcelain')) fail('The working tree has uncommitted changes.');
if (tryGit('describe', '--tags', '--exact-match', '--match', 'v*', 'HEAD')) fail('This commit is already a release.');

const notesPath = (version, language) => join('releases', version, `${language}.md`);
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

// --- push: tag what --prepare left on main ----------------------------------------------

if (push) {
  const version = `v${readJson('package.json').version}`;
  if (!VERSION.test(version)) fail(`package.json has no valid version (${version}).`);
  for (const file of PACKAGES) {
    const other = `v${readJson(file).version}`;
    if (other !== version) fail(`${file} is at ${other}, package.json at ${version} — run --prepare again.`);
  }
  if (tryGit('rev-parse', '-q', '--verify', `refs/tags/${version}`)) fail(`Tag ${version} already exists.`);
  // The Release workflow only accepts a tag on origin's main: a local main ahead of or
  // behind it would push an orphan tag (and the APK step would wait for nothing).
  const remote = 'origin';
  git('fetch', remote, branch);
  const remoteHead = tryGit('rev-parse', `${remote}/${branch}`);
  if (git('rev-parse', 'HEAD') !== remoteHead) {
    fail(`Local ${branch} is not the same commit as ${remote}/${branch} — push or pull first.`);
  }
  const notesFile = option('notes') ?? notesPath(version, 'en');
  if (!existsSync(notesFile)) fail(`${notesFile} is missing — run --prepare on develop first.`);
  const message = readFileSync(notesFile, 'utf8').trim();
  const missing = LANGUAGES.filter((language) => !existsSync(notesPath(version, language)));
  if (missing.length) {
    console.log(`! No ${missing.map((l) => `${l}.md`).join(', ')} in releases/${version} — those languages fall back to English.`);
  }

  console.log(`Release ${version}\n\n${message}\n`);
  if (dryRun) {
    console.log('Dry run — no tag created.');
    process.exit(0);
  }
  // --cleanup=verbatim: the default "strip" would drop the "### Features" headings as
  // if they were comments.
  const file = join(tmpdir(), `myhomelab-release-${process.pid}.md`);
  writeFileSync(file, `${message}\n`);
  try {
    git('tag', '-a', version, '-F', file, '--cleanup=verbatim');
  } finally {
    unlinkSync(file);
  }
  console.log(`✓ Tag ${version} created.`);
  execFileSync('git', ['push', 'origin', version], { stdio: 'inherit' });
  console.log(`✓ ${version} pushed — the Release workflow creates the GitHub Release.`);
  // The Android app follows the site version: its APK goes on the GitHub Release.
  // A failure here does not undo the tag; publish again with npm run release:android.
  try {
    execFileSync('node', [join('scripts', 'android-release.mjs'), version], { stdio: 'inherit' });
  } catch {
    console.log(`! The Android APK was not published — retry with: npm run release:android -- ${version}`);
  }
  process.exit(0);
}

// --- prepare: the commits since the last release ----------------------------------------

const previous = tryGit('describe', '--tags', '--abbrev=0', '--match', 'v*', 'HEAD');
const range = previous ? `${previous}..HEAD` : 'HEAD';
const SEP = '\u001e';
const log = git('log', range, '--no-merges', `--format=%s%x00%b${SEP}`);

const SKIP = new Set(['chore', 'docs', 'ci', 'test', 'style', 'build']);
const SECTION = { feat: 'features', fix: 'fixes', perf: 'improvements', refactor: 'improvements' };
const notes = { features: [], fixes: [], improvements: [] };
let breaking = false;

for (const entry of log.split(SEP)) {
  const [subject = '', body = ''] = entry.replace(/^\n/, '').split('\u0000');
  const m = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/.exec(subject.trim());
  if (!m) continue;
  const [, type, scope, bang, text] = m;
  if (bang || /BREAKING CHANGE/.test(body)) breaking = true;
  if (SKIP.has(type) && !bang) continue;
  const section = SECTION[type] ?? 'improvements';
  notes[section].push(scope ? `**${scope}**: ${text}` : text);
}
const count = notes.features.length + notes.fixes.length + notes.improvements.length;

let version = option('version');
if (version) {
  if (!version.startsWith('v')) version = `v${version}`;
  if (!VERSION.test(version)) fail(`--version must look like 1.2.3 (got ${version}).`);
} else if (!previous) {
  version = 'v1.0.0';
} else {
  if (count === 0) fail(`Nothing to release: no feat/fix/perf/refactor commits since ${previous}.`);
  const [, major, minor, patch] = VERSION.exec(previous).map(Number);
  version = breaking
    ? `v${major + 1}.0.0`
    : notes.features.length
      ? `v${major}.${minor + 1}.0`
      : `v${major}.${minor}.${patch + 1}`;
}
if (tryGit('rev-parse', '-q', '--verify', `refs/tags/${version}`)) fail(`Tag ${version} already exists.`);

let message;
const notesFile = option('notes');
if (notesFile) {
  message = readFileSync(notesFile, 'utf8').trim();
} else {
  const title = option('title') ?? (notes.features[0]?.replace(/\*\*[^*]+\*\*: /, '') || 'Fixes and improvements');
  const lines = [`${version} — ${title}`];
  const add = (heading, items) => {
    if (!items.length) return;
    lines.push('', `### ${heading}`, ...items.map((i) => `- ${i}`));
  };
  add('Features', notes.features);
  add('Fixes', notes.fixes);
  add('Improvements', notes.improvements);
  message = lines.join('\n');
}

console.log(`Previous release: ${previous || '(none)'}`);
console.log(`New release:      ${version}${breaking ? '  (breaking changes)' : ''}\n`);
console.log(message);
console.log('');
if (dryRun) {
  console.log('Dry run — nothing written.');
  process.exit(0);
}

// The versions: every package.json, and the lock files that copy them.
const plain = version.slice(1);
for (const file of PACKAGES) {
  const pkg = readJson(file);
  pkg.version = plain;
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
}
const npm = (cwd) =>
  execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd,
    stdio: 'ignore',
    shell: true,
  });
npm('.');
npm(join('apps', 'mobile'));
console.log(`✓ Version ${plain} in ${PACKAGES.length} package.json files`);

// The changelog: the new version under the marker, unless it is already there.
const CHANGELOG = 'CHANGELOG.md';
const MARKER = '<!-- The release script (npm run release -- --prepare) adds new versions below this line. -->';
const changelog = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, 'utf8') : `# Changelog\n\n${MARKER}\n`;
if (!changelog.includes(`## [${plain}]`)) {
  const [, ...body] = message.split('\n');
  const today = new Date().toISOString().slice(0, 10);
  const entry = `## [${plain}] — ${today}\n${body.join('\n')}\n`;
  const at = changelog.indexOf(MARKER);
  const next =
    at >= 0
      ? `${changelog.slice(0, at + MARKER.length)}\n\n${entry}${changelog.slice(at + MARKER.length)}`
      : `${changelog.trimEnd()}\n\n${entry}`;
  writeFileSync(
    CHANGELOG,
    `${next.trimEnd()}\n${next.includes(`[${plain}]: `) ? '' : `[${plain}]: https://github.com/TTiagoSousa/MyHomeLab/releases/tag/${version}\n`}`,
  );
  console.log(`✓ ${CHANGELOG}`);
}

const english = notesPath(version, 'en');
mkdirSync(join('releases', version), { recursive: true });
writeFileSync(english, `${message}\n`);
console.log(`✓ ${english}`);
console.log('');
console.log(`Next: write releases/${version}/pt-PT.md and es.md (same headings), then`);
console.log(`  git commit -am "chore(release): ${version}" (add the new files), push develop,`);
console.log('  fast-forward staging and main, and on main: npm run release -- --push');
