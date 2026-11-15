#!/usr/bin/env node
// Builds the Android app for a release and attaches the APK to the GitHub Release of
// that tag, as MyHomeLab-X.Y.Z.apk. The release script runs it after pushing the tag
// (the Release workflow creates the GitHub Release; this waits for it). It can also be
// run alone to (re)publish the APK of an existing tag:
//
//   npm run release:android                 the tag on HEAD (or the latest one)
//   npm run release:android -- v1.2.0       a given tag
//   npm run release:android -- --build-only build the APK, publish nothing
//
// Publishing needs a GitHub token with contents: write on the repository, in the
// GITHUB_TOKEN (or GH_TOKEN) environment variable, or the GitHub CLI signed in (gh).
// Signing needs apps/mobile/keystore.properties (see docs/development/07-mobile.md).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const buildOnly = args.includes('--build-only');
const VERSION = /^v(\d+)\.(\d+)\.(\d+)$/;

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

const version =
  args.find((arg) => VERSION.test(arg)) ||
  tryGit('describe', '--tags', '--exact-match', '--match', 'v*', 'HEAD') ||
  tryGit('describe', '--tags', '--abbrev=0', '--match', 'v*', 'HEAD');
if (!VERSION.test(version)) fail('No release tag found — pass one, e.g. v1.24.0.');
const plain = version.slice(1);

// --- build ------------------------------------------------------------------------------

const mobileDir = join('apps', 'mobile');
if (!existsSync(join(mobileDir, 'keystore.properties'))) {
  fail(`${mobileDir}/keystore.properties is missing — the release APK must be signed (see ${mobileDir}/README.md).`);
}
if (!existsSync(join(mobileDir, 'node_modules'))) {
  console.log('Installing the app dependencies (npm ci)…');
  execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: mobileDir, stdio: 'inherit', shell: true });
}

// The Expo app generates its Android project (expo prebuild), builds it with Gradle and
// copies the signed APK to build/apk/MyHomeLab-X.Y.Z.apk.
console.log(`Building the Android app ${plain}…`);
execFileSync('node', [join('scripts', 'build-apk.mjs'), plain], { cwd: mobileDir, stdio: 'inherit' });

const apkName = `MyHomeLab-${plain}.apk`;
const apkPath = join(mobileDir, 'build', 'apk', apkName);
if (!existsSync(apkPath)) fail(`The build finished but ${apkPath} was not found.`);
console.log(`✓ ${apkPath}`);
if (buildOnly) process.exit(0);

// --- publish ----------------------------------------------------------------------------

const ghToken = () => {
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const token = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim() || ghToken();
if (!token) {
  console.log('! No GitHub token (GITHUB_TOKEN, GH_TOKEN or gh auth login) — the APK was built but not published.');
  console.log(`  Publish it later with: npm run release:android -- ${version}`);
  process.exit(0);
}

const remote = tryGit('remote', 'get-url', 'origin');
const match = /github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/.exec(remote);
if (!match) fail(`The origin remote is not a GitHub repository (${remote}).`);
const [, owner, repo] = match;
const api = `https://api.github.com/repos/${owner}/${repo}`;
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

const call = async (method, url, body, extra = {}) => {
  const response = await fetch(url, { method, headers: { ...headers, ...extra }, body });
  if (!response.ok && response.status !== 404) {
    fail(`GitHub ${method} ${url} → ${response.status} ${await response.text()}`);
  }
  return response.status === 404 ? null : response.status === 204 ? {} : response.json();
};

// The Release workflow creates the release a minute or two after the tag is pushed.
let release = null;
for (let attempt = 0; attempt < 40 && !release; attempt++) {
  release = await call('GET', `${api}/releases/tags/${version}`);
  if (!release) {
    if (attempt === 0) console.log(`Waiting for the GitHub Release ${version} (created by the Release workflow)…`);
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
}
if (!release) {
  fail(`No GitHub Release ${version} after 10 minutes — check the Release workflow, then run npm run release:android -- ${version}`);
}

for (const asset of release.assets ?? []) {
  if (asset.name === apkName) await call('DELETE', `${api}/releases/assets/${asset.id}`);
}
await call(
  'POST',
  `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(apkName)}`,
  readFileSync(apkPath),
  { 'Content-Type': 'application/vnd.android.package-archive' },
);

console.log(`✓ ${apkName} published: https://github.com/${owner}/${repo}/releases/download/${version}/${apkName}`);
