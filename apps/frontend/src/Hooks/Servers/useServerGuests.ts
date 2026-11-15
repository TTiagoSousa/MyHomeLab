import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";

export interface ServerGuest {
  vmid: number;
  name: string;
  type: 'qemu' | 'lxc';
  node: string;
  status: string;
}

export const useServerGuests = (serverId?: string | null) => {
  const [guests, setGuests] = useState<ServerGuest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchGuests = async () => {
    if (!serverId) {
      setGuests([]);
      return;
    }
    setLoading(true);
    try {
      const response = await http.get(End_Points.Server_Guests_Endpoint(serverId), { withCredentials: true });
      setGuests(response.data);
      setError('');
    } catch (error: any) {
      setGuests([]);
      setError(error.response?.data?.message || error.message || i18n.t('common:errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests();
  }, [serverId]);

  return { guests, loading, error, fetchGuests };
};
