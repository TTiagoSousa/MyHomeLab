import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_SERVER = '';

const KEYS = {
  server: 'mhl.server',
  username: 'mhl.username',
  signedOut: 'mhl.signedOut',
};

export const loadPrefs = async () => {
  const [server, username, signedOut] = await Promise.all([
    AsyncStorage.getItem(KEYS.server),
    AsyncStorage.getItem(KEYS.username),
    AsyncStorage.getItem(KEYS.signedOut),
  ]);
  return { server: server || DEFAULT_SERVER, username: username ?? '', signedOut: signedOut === '1' };
};

export const saveSignIn = (server: string, username: string) =>
  AsyncStorage.multiSet([
    [KEYS.server, server],
    [KEYS.username, username],
    [KEYS.signedOut, '0'],
  ]);

export const saveSignOut = () => AsyncStorage.setItem(KEYS.signedOut, '1');
