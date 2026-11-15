import { useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import i18n from "../../i18n";
import { useAlert } from "../../Contexts/Alert_Context";

export const useCategory = () => {
  const [loading, setLoading] = useState(false);
  const { setAlert } = useAlert();

  const createCategory = async (name: string) => {
    setLoading(true);
    try {
      await http.post(End_Points.Category_Endpoint(), { name }, { withCredentials: true });
      setAlert({ open: true, message: i18n.t("services:alerts.categoryCreated"), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t("common:errors.generic");
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (id: string) => {
    setLoading(true);
    try {
      await http.delete(End_Points.Category_By_Id_Endpoint(id), { withCredentials: true });
      setAlert({ open: true, message: i18n.t("services:alerts.categoryDeleted"), type: 'success' });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t("common:errors.generic");
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const reorderCategories = async (orderedIds: string[]) => {
    try {
      await http.patch(End_Points.Category_Reorder_Endpoint(), { orderedIds }, { withCredentials: true });
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || i18n.t("common:errors.generic");
      setAlert({ open: true, message: msg, type: 'error' });
      return false;
    }
  };

  return { createCategory, deleteCategory, reorderCategories, loading };
};
