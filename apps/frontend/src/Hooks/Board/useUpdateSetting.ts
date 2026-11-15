import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import { boardErrorMessage } from "./useBoardProjects";

export interface UpdateSetting {
  boardModules: string[];
}

export const useUpdateSetting = (enabled: boolean) => {
  const [setting, setSetting] = useState<UpdateSetting | null>(null);
  const { setAlert } = useAlert();

  const fetchSetting = async () => {
    if (!enabled) return;
    try {
      const response = await http.get(End_Points.Update_Setting_Endpoint(), { withCredentials: true });
      setSetting(response.data);
    } catch {
      setSetting(null);
    }
  };

  useEffect(() => {
    fetchSetting();
  }, [enabled]);

  const saveSetting = async (changes: Partial<UpdateSetting>) => {
    try {
      const response = await http.put(End_Points.Update_Setting_Endpoint(), changes, { withCredentials: true });
      setSetting(response.data);
    } catch (error: any) {
      setAlert({ open: true, message: boardErrorMessage(error), type: 'error' });
    }
  };

  return { setting, saveSetting };
};
