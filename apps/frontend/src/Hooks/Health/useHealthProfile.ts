import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { healthErrorMessage } from "./healthErrors";
import type { HealthProfile, HealthProfileFields } from "./healthTypes";

export const useHealthProfile = (refreshKey = 0) => {
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const fetchProfile = async () => {
    try {
      const response = await http.get(End_Points.Health_Profile_Endpoint(), { withCredentials: true });
      setProfile(response.data);
    } catch {
      setProfile(null);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [refreshKey]);

  const saveProfile = async (fields: Partial<HealthProfileFields>): Promise<string | null> => {
    setSaving(true);
    try {
      const response = await http.put(End_Points.Health_Profile_Endpoint(), fields, { withCredentials: true });
      setProfile(response.data);
      setAlert({ open: true, message: i18n.t('health:profile.saved'), type: 'success' });
      return null;
    } catch (error: any) {
      return healthErrorMessage(error);
    } finally {
      setSaving(false);
    }
  };

  return { profile, saving, saveProfile };
};
