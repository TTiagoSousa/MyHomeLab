#!/usr/bin/env node
// Compila o APK de release sem EAS: gera a pasta android/ com o prebuild (nunca vai para o
// git), corre o Gradle e copia o APK assinado para build/apk/MyHomeLab-<versão>.apk.
//
//   node scripts/build-apk.mjs 1.26.0              arm64-v8a + armeabi-v7a (telemóveis)
//   ABIS=x86_64 node scripts/build-apk.mjs 1.26.0  só x86_64 (emulador), com sufixo no nome
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = (process.argv[2] ?? process.env.APP_VERSION ?? '').replace(/^v/, '');
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('✗ Usage: node scripts/build-apk.mjs <X.Y.Z>');
  process.exit(1);
}
if (!existsSync(join(root, 'keystore.properties'))) {
  console.error('✗ keystore.properties is missing — the release APK must be signed (see README.md).');
  process.exit(1);
}

const windows = process.platform === 'win32';
const defaultSdk = windows && process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : '';
const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || (existsSync(defaultSdk) ? defaultSdk : '');
if (!androidHome) {
  console.error('✗ Android SDK not found — set ANDROID_HOME.');
  process.exit(1);
}
const env = { ...process.env, ANDROID_HOME: androidHome, APP_VERSION: version, NODE_ENV: 'production' };
const run = (command, args, cwd) =>
  execFileSync(windows ? 'cmd' : command, windows ? ['/c', command, ...args] : args, { cwd, env, stdio: 'inherit' });

console.log(`Building MyHomeLab ${version} (${env.ABIS ?? 'arm64-v8a,armeabi-v7a'})…`);
run('npx', ['expo', 'prebuild', '-p', 'android', '--clean', '--no-install'], root);
const androidDir = join(root, 'android');
run(join(androidDir, windows ? 'gradlew.bat' : 'gradlew'), ['assembleRelease', '--no-daemon', '--console=plain'], androidDir);

const outputDir = join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release');
const built = readdirSync(outputDir).find((name) => name.endsWith('.apk'));
if (!built) {
  console.error(`✗ No APK in ${outputDir}`);
  process.exit(1);
}

const suffix = env.ABIS && env.ABIS !== 'arm64-v8a,armeabi-v7a' ? `-${env.ABIS.replace(/,/g, '_')}` : '';
const target = join(root, 'build', 'apk', `MyHomeLab-${version}${suffix}.apk`);
mkdirSync(dirname(target), { recursive: true });
copyFileSync(join(outputDir, built), target);
console.log(`✓ ${target}`);
