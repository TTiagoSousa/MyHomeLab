import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import type { RunFrequency } from "@myhomelab/shared";

export type ConnectionProvider = 'GMAIL' | 'OUTLOOK' | 'IMAP' | 'NEXTCLOUD' | 'FORGEJO' | 'TREK' | 'HOME_ASSISTANT' | 'ADGUARD' | 'GOOGLE_TASKS' | 'OPENGYM' | 'GAMETRACKER' | 'IMMICH' | 'PAPERLESS' | 'SOLIDTIME' | 'STIRLING_PDF';
export type { RunFrequency } from "@myhomelab/shared";

export interface ConnectedAccount {
  id: string;
  userId: string;
  provider: ConnectionProvider;
  emailAddress: string | null;
  displayName: string | null;
  caldavUsername?: string | null;
  caldavHost?: string | null;
  username?: string | null;
  forgejoHost?: string | null;
  appHost?: string | null;
  isAdmin?: boolean;
  appWorkspace?: string | null;
  appVersion?: string | null;
  appLatestVersion?: string | null;
  appLatestUrl?: string | null;
  appCheckedAt?: string | null;
  serverConnectionId?: string | null;
  guestVmid?: number | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  isActive: boolean;
  runFrequency: RunFrequency;
  proposalFrequency: RunFrequency | null;
  lastProposalRunAt: string | null;
  autoImplementProposalsAfterDays: number | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const useConnectedAccounts = (provider?: ConnectionProvider) => {
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchConnectedAccounts = async () => {
    setLoading(true);
    try {
      const response = await http.get(End_Points.Connected_Account_Endpoint(), {
        params: provider ? { provider } : undefined,
        withCredentials: true,
      });
      setConnectedAccounts(response.data);
      setError('');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t('common:errors.generic');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnectedAccounts();
  }, [provider]);

  return { connectedAccounts, loading, error, fetchConnectedAccounts };
};
