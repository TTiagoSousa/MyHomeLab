import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { NOTIFICATIONS_CHANGED } from "./useNotifications";

const REFRESH_MS = 60_000;

export const useNotificationCount = () => {
  const [count, setCount] = useState(0);

  const fetchCount = async () => {
    try {
      const response = await http.get(End_Points.Notifications_Count_Endpoint(), { withCredentials: true });
      setCount(response.data.active);
    } catch {
      setCount(0);
    }
  };

  useEffect(() => {
    fetchCount();

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') fetchCount();
    };
    const timer = setInterval(refreshIfVisible, REFRESH_MS);
    window.addEventListener(NOTIFICATIONS_CHANGED, fetchCount);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED, fetchCount);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, []);

  return { count, fetchCount };
};
