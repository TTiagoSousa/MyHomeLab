import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";

export type ApiTokenScope = 'READ' | 'FULL';

export interface ApiToken {
  id: string;
  name: string;
  scope: ApiTokenScope;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const errorMessage = (error: any) => error.response?.data?.message || error.message || i18n.t('common:errors.generic');

export const useApiTokens = () => {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchTokens = async () => {
    try {
      const response = await http.get<ApiToken[]>(End_Points.Api_Tokens_Endpoint(), { withCredentials: true });
      setTokens(response.data);
      setError('');
    } catch (error: any) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  const createToken = async (name: string, scope: ApiTokenScope, expiresInDays: number | null) => {
    setSaving(true);
    try {
      const response = await http.post<ApiToken & { token: string }>(
        End_Points.Api_Tokens_Endpoint(),
        { name, scope, ...(expiresInDays ? { expiresInDays } : {}) },
        { withCredentials: true },
      );
      const { token, ...saved } = response.data;
      setTokens([saved, ...tokens]);
      setError('');
      return token;
    } catch (error: any) {
      setError(errorMessage(error));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const revokeToken = async (id: string) => {
    setSaving(true);
    try {
      await http.delete(End_Points.Api_Token_Endpoint(id), { withCredentials: true });
      setTokens(tokens.filter((token) => token.id !== id));
      setError('');
    } catch (error: any) {
      setError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return { tokens, loading, saving, error, createToken, revokeToken };
};
