import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, onUnauthorized, setServerUrl } from '../api/client';
import * as api from '../api/endpoints';
import type { SessionUser } from '../api/types';
import { loadPrefs, saveSignIn, saveSignOut } from '../utils/prefs';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthValue {
  status: AuthStatus;
  user: SessionUser | null;
  server: string;
  lastUsername: string;
  signIn: (server: string, username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const normalizeServer = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [server, setServer] = useState('');
  const [lastUsername, setLastUsername] = useState('');

  const fetchSession = async () => {
    const prefs = await loadPrefs();
    setServer(prefs.server);
    setLastUsername(prefs.username);
    setServerUrl(prefs.server);
    if (prefs.signedOut || !prefs.username) {
      setStatus('signedOut');
      return;
    }
    try {
      setUser(await api.me());
      setStatus('signedIn');
    } catch (error) {
      setStatus(error instanceof ApiError && error.status === 401 ? 'signedOut' : 'signedIn');
    }
  };

  useEffect(() => {
    onUnauthorized(() => {
      setUser(null);
      setStatus('signedOut');
    });
    fetchSession();
  }, []);

  const signIn = async (serverInput: string, username: string, password: string) => {
    const nextServer = normalizeServer(serverInput);
    setServerUrl(nextServer);
    await api.login(username.trim(), password);
    const session = await api.me();
    await saveSignIn(nextServer, username.trim());
    setServer(nextServer);
    setLastUsername(username.trim());
    setUser(session);
    setStatus('signedIn');
  };

  const signOut = async () => {
    try {
      await api.logout();
    } catch {
      setUser(null);
    }
    await saveSignOut();
    setUser(null);
    setStatus('signedOut');
  };

  return (
    <AuthContext.Provider value={{ status, user, server, lastUsername, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth outside AuthProvider');
  return value;
};
