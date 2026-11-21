import { useEffect, useState } from 'react';
import { End_Points } from '../../Service/endPoints';
import http from '../../Service/httpService';
import i18n from '../../i18n';

export type TplinkBand = '2g' | '5g' | '6g';
export type TplinkNetwork = 'host' | 'guest' | 'iot';
export type TplinkKind = 'router' | 'extender';
export type TplinkBandFlags = Partial<Record<TplinkBand, boolean | null>>;

export interface TplinkConnection {
  state: 'connected' | 'disconnected' | 'failed';
  since: string;
  message: string | null;
  nextRetryAt: string | null;
  scheme: 'classic' | 'v1_11' | 'sg' | null;
  kind: TplinkKind;
}

export interface TplinkDevice {
  mac: string;
  ip: string;
  hostname: string;
  connection: string;
  downSpeed: number | null;
  upSpeed: number | null;
  signal: number | null;
  onlineSeconds: number | null;
  trafficBytes: number | null;
  apName?: string | null;
  viaSatellite?: boolean;
}

export interface TplinkWifiNetwork {
  network: TplinkNetwork;
  band: TplinkBand;
  enabled: boolean | null;
  ssid: string | null;
  hidden: boolean | null;
  encryption: string | null;
  channel: number | null;
}

export interface TplinkBackhaulBand {
  connection: string | null;
  connected: boolean;
  ssid: string | null;
  rssi: number | null;
  rxRateMbps: number | null;
  txRateMbps: number | null;
}

export interface TplinkRepeater {
  band2g: TplinkBackhaulBand;
  band5g: TplinkBackhaulBand;
  wired: { connected: boolean; ip: string | null } | null;
  internetStatus: string | null;
  meshEnabled: boolean | null;
  meshSync: string | null;
}

export interface TplinkRouterData {
  kind: TplinkKind;
  repeater: TplinkRepeater | null;
  firmware: { model: string; hardwareVersion: string; firmwareVersion: string };
  status: {
    wanMac: string | null;
    lanMac: string | null;
    wanIp: string | null;
    lanIp: string | null;
    wanGateway: string | null;
    wanUptimeSeconds: number | null;
    wanConnType: string | null;
    wanIpv6Enabled: boolean | null;
    lanDhcpEnabled: boolean | null;
    cpuUsage: number | null;
    memUsage: number | null;
    wifi: Record<TplinkNetwork, TplinkBandFlags>;
    mlo: TplinkBandFlags;
    wiredTotal: number;
    wifiTotal: number;
    guestTotal: number;
    iotTotal: number;
    devices: TplinkDevice[];
  };
  wifi: TplinkWifiNetwork[];
  ports: { port: number; name: string; linkUp: boolean | null; speedMbps: number | null; duplex: string | null }[];
  mesh: { name: string; model: string; role: string; status: string; mac: string; ip: string; clients: number | null }[];
  leases: { mac: string; ip: string; name: string; leaseTime: string }[];
  reservations: { mac: string; ip: string; name: string; enabled: boolean | null }[];
  portForwards: { name: string; ip: string; externalPort: string; internalPort: string; protocol: string; enabled: boolean | null }[];
  accessControl: { enabled: boolean; mode: 'blacklist' | 'whitelist' } | null;
  blocked: { mac: string; name: string }[];
}

export interface TplinkRouterStatus {
  connection: TplinkConnection;
  router: TplinkRouterData | null;
  version: string | null;
}

const RETRY_POLL_MS = 60_000;

export const useTplinkRouterStatus = (accountId: string | undefined) => {
  const [status, setStatus] = useState<TplinkRouterStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = async (force = false) => {
    if (!accountId) return;
    setLoading(true);
    try {
      const response = await http.get(End_Points.Connected_Account_Tplink_Router_Status_Endpoint(accountId), {
        params: force ? { force: 1 } : undefined,
        withCredentials: true,
      });
      setStatus(response.data);
      setError('');
    } catch (error: any) {
      setError(error.response?.data?.message || error.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [accountId]);

  const disconnected = status?.connection.state === 'disconnected';

  useEffect(() => {
    if (!disconnected) return;
    const timer = setInterval(() => fetchStatus(), RETRY_POLL_MS);
    return () => clearInterval(timer);
  }, [accountId, disconnected]);

  return { status, loading, error, fetchStatus };
};
