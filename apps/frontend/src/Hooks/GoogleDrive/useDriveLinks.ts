import { useEffect, useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";

export interface Drive_Link {
  id: string;
  fileId: string;
  name: string;
  mimeType: string;
  createdAt: string;
  project: { id: string; name: string };
}

interface Api_Error {
  message?: string;
  response?: { data?: { message?: string | string[] } };
}

const errorMessage = (error: unknown) => {
  const failure = error as Api_Error;
  const message = failure.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  return message || failure.message || i18n.t('common:errors.generic');
};

export const useDriveLinks = (accountId: string) => {
  const [links, setLinks] = useState<Drive_Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { setAlert } = useAlert();

  const fetchLinks = async () => {
    try {
      const response = await http.get<Drive_Link[]>(End_Points.Google_Drive_Links_Endpoint(accountId), { withCredentials: true });
      setLinks(response.data);
    } catch (error) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, [accountId]);

  const addLink = async (target: string, projectId: string) => {
    setSaving(true);
    try {
      await http.post(End_Points.Google_Drive_Links_Endpoint(accountId), { target, projectId }, { withCredentials: true });
      await fetchLinks();
      return true;
    } catch (error) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const removeLink = async (id: string) => {
    setSaving(true);
    try {
      await http.delete(End_Points.Google_Drive_Link_Endpoint(id), { withCredentials: true });
      await fetchLinks();
    } catch (error) {
      setAlert({ open: true, message: errorMessage(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return { links, loading, saving, addLink, removeLink };
};
