import { execFileSync } from 'node:child_process';
import type { ExpoConfig } from 'expo/config';

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

const versionFromGit = () => {
  try {
    return execFileSync('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .replace(/^v/, '');
  } catch {
    return '';
  }
};

const candidate = (process.env.APP_VERSION ?? '').replace(/^v/, '') || versionFromGit();
const version = VERSION.test(candidate) ? candidate : '0.0.0';
const [major, minor, patch] = version.split('.').map(Number);
const versionCode = Math.max(1, major * 10000 + minor * 100 + patch);

const abis = (process.env.ABIS ?? 'arm64-v8a,armeabi-v7a')
  .split(',')
  .map((abi) => abi.trim())
  .filter(Boolean);

const config: ExpoConfig = {
  name: 'MyHomeLab',
  slug: 'myhomelab',
  version,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#060B12',
  android: {
    package: 'me.homesousa.myhomelab',
    versionCode,
    adaptiveIcon: {
      backgroundColor: '#060B12',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: [
      'android.permission.VIBRATE',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.USE_EXACT_ALARM',
      'android.permission.SCHEDULE_EXACT_ALARM',
    ],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false }],
    'expo-localization',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 160, backgroundColor: '#060B12' }],
    ['expo-notifications', { color: '#3FD0E8', icon: './assets/notification-icon.png' }],
    ['./plugins/withAndroidBuild', { abis }],
    './plugins/withReleaseSigning',
  ],
};

export default config;
