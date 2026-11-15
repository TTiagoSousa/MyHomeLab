import Constants from 'expo-constants';

export const appVersion = () => Constants.expoConfig?.version ?? '0.0.0';

const parts = (version: string) =>
  [...version.replace(/^v/, '').split('-')[0].split('.').map((part) => Number(part) || 0), 0, 0, 0].slice(0, 3);

export const isNewer = (candidate: string, current: string) => {
  const a = parts(candidate);
  const b = parts(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
};
