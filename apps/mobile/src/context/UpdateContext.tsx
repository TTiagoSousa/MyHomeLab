import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as api from '../api/endpoints';
import type { AndroidRelease } from '../api/types';
import { appVersion, isNewer } from '../utils/version';

interface UpdateValue {
  release: AndroidRelease | null;
  dismiss: () => void;
}

const UpdateContext = createContext<UpdateValue | null>(null);

export const UpdateProvider = ({ children }: { children: ReactNode }) => {
  const [release, setRelease] = useState<AndroidRelease | null>(null);

  const fetchRelease = async () => {
    try {
      const latest = await api.androidRelease();
      if (latest.version && latest.downloadUrl && isNewer(latest.version, appVersion())) setRelease(latest);
    } catch {
      setRelease(null);
    }
  };

  useEffect(() => {
    fetchRelease();
  }, []);

  return (
    <UpdateContext.Provider value={{ release, dismiss: () => setRelease(null) }}>{children}</UpdateContext.Provider>
  );
};

export const useUpdate = () => {
  const value = useContext(UpdateContext);
  if (!value) throw new Error('useUpdate outside UpdateProvider');
  return value;
};
