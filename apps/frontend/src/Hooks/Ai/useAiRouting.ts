import { useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { aiErrorMessage, type AiProviderId } from "./useAiProviders";

export const AI_WORKS = ['chat', 'study', 'install', 'schedule', 'delegation'] as const;
export type AiWork = (typeof AI_WORKS)[number];
export type AiRoutes = Record<AiWork, AiProviderId>;

export interface AiRouting {
  mixed: boolean;
  available: boolean;
  routes: AiRoutes;
  defaultRoutes: AiRoutes;
  maxClaudeCodeRuns: number;
  claudeCode: { running: number; waiting: number };
}

export interface AiRoutingChange {
  mixed?: boolean;
  routes?: Partial<AiRoutes>;
  maxClaudeCodeRuns?: number;
}

export const useAiRouting = () => {
  const [routing, setRouting] = useState<AiRouting | null>(null);
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const fetchRouting = async () => {
    try {
      const response = await http.get<AiRouting>(End_Points.Ai_Routing_Endpoint(), { withCredentials: true });
      setRouting(response.data);
    } catch {
      setRouting(null);
    }
  };

  const saveRouting = async (change: AiRoutingChange) => {
    setSaving(true);
    try {
      const response = await http.put<AiRouting>(End_Points.Ai_Routing_Endpoint(), change, { withCredentials: true });
      setRouting(response.data);
      setAlert({ open: true, message: i18n.t('settings:routing.saved'), type: 'success' });
      return true;
    } catch (error) {
      setAlert({ open: true, message: aiErrorMessage(error), type: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { routing, saving, fetchRouting, saveRouting };
};
