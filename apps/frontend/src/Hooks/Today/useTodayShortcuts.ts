import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';
import type { ConnectionProvider } from '../ConnectedAccount/useConnectedAccounts';

export type Today_Shortcut_Kind = 'APP' | 'EMAIL_RULES' | 'LINK';

export interface Today_Shortcut {
  id: string;
  kind: Today_Shortcut_Kind;
  label: string | null;
  url: string | null;
  account: { id: string; provider: ConnectionProvider; displayName: string | null } | null;
}

export interface New_Today_Shortcut {
  kind: Today_Shortcut_Kind;
  accountId?: string;
  label?: string;
  url?: string;
}

const errorMessage = (error: any) =>
  error.response?.data?.message || error.message || i18n.t('common:errors.generic');

export const useTodayShortcuts = () => {
  const [shortcuts, setShortcuts] = useState<Today_Shortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchShortcuts = async () => {
    setLoading(true);
    try {
      const response = await http.get(End_Points.Today_Shortcuts_Endpoint(), { withCredentials: true });
      setShortcuts(response.data);
      setError('');
    } catch (error: any) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const addShortcut = async (shortcut: New_Today_Shortcut): Promise<string> => {
    try {
      const response = await http.post(End_Points.Today_Shortcuts_Endpoint(), shortcut, { withCredentials: true });
      setShortcuts((current) => [...current, response.data]);
      return '';
    } catch (error: any) {
      return errorMessage(error);
    }
  };

  const removeShortcut = async (id: string) => {
    try {
      await http.delete(End_Points.Today_Shortcut_Endpoint(id), { withCredentials: true });
      setShortcuts((current) => current.filter((shortcut) => shortcut.id !== id));
    } catch (error: any) {
      setError(errorMessage(error));
    }
  };

  useEffect(() => {
    fetchShortcuts();
  }, []);

  return { shortcuts, loading, error, addShortcut, removeShortcut };
};
