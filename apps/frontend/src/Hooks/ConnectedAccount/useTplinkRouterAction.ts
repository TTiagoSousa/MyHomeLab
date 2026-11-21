import { useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';
import { useAlert } from '../../Contexts/Alert_Context';
import type { TplinkBand, TplinkNetwork } from './useTplinkRouterStatus';

export type TplinkRouterActionName =
  'wifi' | 'block' | 'unblock' | 'accessControl' | 'reservationAdd' | 'reservationDelete' | 'portForwardAdd' | 'portForwardDelete' | 'wanRenew' | 'reboot';

export interface TplinkRouterActionPayload {
  action: TplinkRouterActionName;
  network?: TplinkNetwork;
  band?: TplinkBand;
  enabled?: boolean;
  mode?: 'blacklist' | 'whitelist';
  mac?: string;
  name?: string;
  ip?: string;
  externalPort?: string;
  internalPort?: string;
  protocol?: 'TCP' | 'UDP' | 'ALL';
}

export const useTplinkRouterAction = (accountId: string | undefined) => {
  const [running, setRunning] = useState<TplinkRouterActionName | null>(null);
  const { setAlert } = useAlert();

  const runAction = async (payload: TplinkRouterActionPayload) => {
    if (!accountId) return false;
    setRunning(payload.action);
    try {
      const response = await http.post(End_Points.Connected_Account_Tplink_Router_Action_Endpoint(accountId), payload, { withCredentials: true });
      setAlert({ open: true, message: response.data.message, type: response.data.ok ? 'success' : 'warning' });
      return Boolean(response.data.ok);
    } catch (error: any) {
      setAlert({ open: true, message: error.response?.data?.message || error.message || i18n.t('common:errors.generic'), type: 'error' });
      return false;
    } finally {
      setRunning(null);
    }
  };

  return { running, runAction };
};
