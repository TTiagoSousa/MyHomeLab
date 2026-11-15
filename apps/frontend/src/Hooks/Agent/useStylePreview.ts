import { useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";

export interface StylePreview {
  question: string;
  before: string;
  after: string;
}

export const useStylePreview = () => {
  const [preview, setPreview] = useState<StylePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const { setAlert } = useAlert();

  const fetchPreview = async (customPrompt: string) => {
    setLoading(true);
    try {
      const response = await http.post(End_Points.Assistant_Preview_Style_Endpoint(), { customPrompt }, { withCredentials: true });
      setPreview(response.data);
    } catch (error: any) {
      setAlert({ open: true, message: error?.response?.data?.message || error?.message || i18n.t('common:errors.generic'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return { preview, loading, fetchPreview };
};
